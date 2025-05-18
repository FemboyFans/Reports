import { convertIPAddress, getDate, getEndOfDay } from "./common.js";
import client from "../client.js";
import Redis from "../redis.js";
import type { FastiyServer } from "../server.js";
import { verify } from "../bodyHandler.js";

async function logPostView(post_id: number, ip_address: string): Promise<boolean> {
    ip_address = convertIPAddress(ip_address);

    if (await checkDuplicate(post_id, ip_address)) {
        console.log("duplicate view");
        return false;
    }
    const r = await client.insert({
        table:  "post_views",
        values: [{ post_id, ip_address }],
        format: "JSONEachRow"
    });
    await Redis.multi()
        .set(`post_views:${post_id}:${ip_address}`, "1", "PXAT", getEndOfDay(), "NX")
        .incr("post_views")
        .incr(`post_views:${getDate()}`)
        .incr(`post_views:${post_id}`)
        .incr(`post_views:${post_id}:${getDate()}`)
        .exec();
    return r.executed;
}

async function getPostViewRank(dates?: Array<string>, limit = 50, unique = false): Promise<Array<{ count: number; post: number; }>> {
    const r = await client.query({
        query:        `SELECT post_id, COUNT(${unique ? "DISTINCT ip_address" : ""}) as view_count FROM post_views ${dates ? "WHERE date IN ({dates:Array(Date)}) " : ""} GROUP BY post_id ORDER BY view_count DESC LIMIT {limit:UInt64}`,
        query_params: { dates, limit },
        format:       "JSON"
    });

    return (await r.json<{ post_id: string; view_count: string; }>()).data.map(v => ({ post: Number(v.post_id), count: Number(v.view_count) }));
}

async function getPostViewsBulk(posts: Array<number>, date?: string, unique = false): Promise<Array<{ count: number; post: number; }>> {
    const r = await client.query({
        query:        `SELECT post_id, COUNT(${unique ? "DISTINCT ip_address" : ""}) as view_count FROM post_views WHERE post_id IN ({posts:Array(UInt64)})${date ? " AND date = {date:Date}" : ""} GROUP BY post_id LIMIT 100`,
        query_params: { posts, date },
        format:       "JSON"
    });

    return (await r.json<{ post_id: string; view_count: string; }>()).data.map(v => ({ post: Number(v.post_id), count: Number(v.view_count) }));
}

// expects an already formatted ip_address
async function checkDuplicate(post_id: number, ip_address: string): Promise<boolean> {
    const v = await Redis.get(`post_views:${post_id}:${ip_address}`);
    if (v === null) {
        // double check
        return checkPostView(post_id, ip_address);
    }
    return true;
}

// expects an already formatted ip_address
async function checkPostView(post_id: number, ip_address: string): Promise<boolean> {
    const r = await client.query({
        query:        "SELECT 1 FROM post_views WHERE post_id = {post_id:UInt64} AND ip_address = {ip_address:IPv6} AND date = today() LIMIT 1",
        query_params: { post_id, ip_address },
        format:       "JSON"
    });
    return ((await r.json()).rows ?? 0) !== 0;
}

async function getViewCount(post_id: number, date?: string, unique = false): Promise<number> {
    const r = await Redis.get(`post_views:${post_id}${date ? `:${date}` : ""}`);
    if (r !== null) {
        return Number(r);
    }
    const q = await client.query({
        query:        `SELECT COUNT(${unique ? "DISTINCT ip_address" : ""}) FROM post_views WHERE post_id = {post_id:UInt64}${date ? " AND date = {date:Date}" : ""}`,
        query_params: { post_id, date },
        format:       "JSON"
    });
    return Number((await q.json<Record<"COUNT()", string>>()).data[0]["COUNT()"]);
}

export function registerRoutes(app: FastiyServer): void {
    app.get("/views/rank", async (request, reply) => {
        const qparams = request.query as Record<string, unknown>;
        const dates: Array<string> = [];
        if (qparams.date) {
            dates.push(qparams.date as string);
        } else {
            const d = new Date();
            dates.push(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
        }
        if (qparams.days) {
            const days = Number(qparams.days);
            if (days > 30) {
                return reply.status(400).send({ error: "Max days is 30", success: false });
            }
            for (let i = 1; i < days; i++) {
                const d = new Date(dates[0]);
                d.setDate(d.getDate() - i);
                dates.push(`${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`);
            }
        }
        const limit = qparams.limit ? Number(qparams.limit) : 50;

        return reply.status(200).send({ data: await getPostViewRank(dates, limit, qparams.unique === "true"), success: true });
    });

    app.get("/views/top", async (request, reply) => {
        const qparams = request.query as Record<string, unknown>;
        const limit = qparams.limit ? Number(qparams.limit) : 50;

        return reply.status(200).send({ data: await getPostViewRank(undefined, limit, qparams.unique === "true"), success: true });
    });

    app.get("/views/bulk", async (request, reply) => {
        const qparams = request.query as Record<string, unknown>;
        let posts: Array<number>;
        if (qparams.posts) {
            if (Array.isArray(qparams.posts)) {
                posts = (qparams.posts as Array<number>);
            } else {
                posts = (qparams.posts as string).split(",").map(Number);
            }
        } else {
            return reply.status(400).send({ error: "Invalid request", success: false });
        }
        posts = posts.slice(0, 100);

        const data = await getPostViewsBulk(posts, qparams.date as string, qparams.unique === "true");
        for (const post of posts) {
            if (!data.some(v => v.post === post)) {
                data.push({ post, count: 0 });
            }
        }
        data.sort((a, b) => posts.indexOf(a.post) - posts.indexOf(b.post));
        return reply.status(200).send({ data, success: true });
    });

    app.get("/views/:id", async (request, reply) => {
        const params = request.params as Record<string, unknown>;
        const qparams = request.query as Record<string, unknown>;
        const id = Number(params.id);
        if (isNaN(id)) {
            return reply.status(400).send({ error: "Invalid post ID", success: false });
        }

        const res = await getViewCount(id, qparams.date as string, qparams.unique === "true");
        return reply.status(200).send({ data: res, success: true });
    });

    app.post("/views", async (request, reply) => {
        if (!request.body || typeof request.body !== "object" || !("msg" in request.body)) {
            return reply.status(400).send({ error: "Invalid request body", success: false });
        }
        let msg: { ip_address: string; post_id: number; };
        try {
            msg = verify((request.body as Record<string, string>).msg as string, "view");
        } catch (err) {
            return reply.status(400).send({ error: (err as Error).message, success: false });
        }
        const ip = request.ip;
        if (msg.ip_address !== ip) {
            return reply.status(403).send({ error: "IP address mismatch", success: false });
        }
        const r = await logPostView(msg.post_id, ip);
        return reply.status(r ? 201 : 200).send({ success: true });
    });
}
