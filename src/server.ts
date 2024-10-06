import {
    getMissedSearchRank,
    getPostViewRank,
    getPostViewsBulk,
    getSearchRank,
    getViewCount,
    logMissedSearch,
    logPostView,
    logSearch
} from "./track.js";
import Config from "./config.js";
import { verify } from "./bodyHandler.js";
import Fastify from "fastify";
import FastifyMiddleware from "@fastify/middie";
import FastifyJWT from "@fastify/jwt";
import { type JwtPayload } from "jsonwebtoken";
import fastifyCors from "@fastify/cors";

const app = await Fastify({
    logger: {
        level: "info"
    },
    trustProxy: true
});
await app.register(FastifyMiddleware);
await app.register(FastifyJWT, {
    secret: Config.secretKey,
    decode: { complete: true },
    verify: { allowedIss: "FemboyFans", allowedAud: "Reports" }
});
await app.register(fastifyCors, {
    origin:         "*",
    allowedHeaders: ["Content-Type", "Authorization"]
});

app.addHook("onRequest", async (request, reply) => {
    if (request.method === "OPTIONS" || request.url === "/up") {
        return;
    }
    try {
        await request.jwtVerify<JwtPayload>({
            verify: {
                allowedSub: request.url.split("?")[0]
            },
            decode: {}
        });
    } catch (error) {
        return reply.send(error);
    }
});

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

app.post("/searches", async (request, reply) => {
    if (!request.body || typeof request.body !== "object" || !("msg" in request.body)) {
        return reply.status(400).send({ error: "Invalid request body", success: false });
    }
    let msg: { ip_address: string; page: number; tags: Array<string>; };
    try {
        msg = verify((request.body as Record<string, string>).msg as string, "search");
    } catch (err) {
        return reply.status(400).send({ error: (err as Error).message, success: false });
    }
    const ip = request.ip;
    if (msg.ip_address !== ip) {
        return reply.status(403).send({ error: "IP address mismatch", success: false });
    }
    if (!Array.isArray(msg.tags) || typeof msg.page !== "number") {
        return reply.status(400).send({ error: "Invalid request body", success: false });
    }
    const r = await logSearch(msg.tags as Array<string>, msg.page);
    return reply.status(r ? 201 : 200).send({ success: true });
});

app.get("/searches/rank", async (request, reply) => {
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

    return reply.status(200).send({ data: await getSearchRank(dates, limit), success: true });
});

app.post("/searches/missed", async (request, reply) => {
    if (!request.body || typeof request.body !== "object" || !("msg" in request.body)) {
        return reply.status(400).send({ error: "Invalid request body", success: false });
    }
    let msg: { ip_address: string; page: number; tags: Array<string>; };
    try {
        msg = verify((request.body as Record<string, string>).msg as string, "missed-search");
    } catch (err) {
        return reply.status(400).send({ error: (err as Error).message, success: false });
    }
    const ip = request.ip;
    if (msg.ip_address !== ip) {
        return reply.status(403).send({ error: "IP address mismatch", success: false });
    }
    if (!Array.isArray(msg.tags) || typeof msg.page !== "number") {
        return reply.status(400).send({ error: "Invalid request body", success: false });
    }
    const r = await logMissedSearch(msg.tags as Array<string>, msg.page);
    return reply.status(r ? 201 : 200).send({ success: true });
});

app.get("/searches/missed/rank", async (request, reply) => {
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

    return reply.status(200).send({ data: await getMissedSearchRank(dates, limit), success: true });
});

app.get("/up", async(request, reply) => reply.status(204).send());

await app.listen({
    host: "0.0.0.0",
    port: 3000
});
