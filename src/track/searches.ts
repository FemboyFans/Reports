import { getDate } from "./common.js";
import client from "../client.js";
import Redis from "../redis.js";
import type { FastiyServer } from "../server.js";
import { verify } from "../bodyHandler.js";

async function logSearch(tags: Array<string>, page: number): Promise<boolean> {
    const r = Redis.multi()
        .incr("searches")
        .incr(`searches:${getDate()}`);
    if (tags.length === 1) {
        r.incr(`searches:${tags[0]}`);
        r.incr(`searches:${tags[0]}:${getDate()}`);
    }
    await r.exec();

    const q = await client.insert({
        table:  "post_searches",
        values: [{ tags, page }],
        format: "JSONEachRow"
    });
    return q.executed;
}

async function getSearchRank(dates: Array<string>, limit = 50): Promise<Array<{ count: number; tag: string; }>> {
    const r = await client.query({
        query:        "SELECT tags, COUNT(*) as count FROM post_searches WHERE date IN ({dates:Array(Date)}) AND length(tags) = 1 GROUP BY tags ORDER BY count DESC LIMIT {limit:UInt64}",
        query_params: { dates, limit },
        format:       "JSON"
    });

    return (await r.json<{ count: string; tags: Array<string>; }>()).data.map(v => ({ tag: v.tags[0], count: Number(v.count) }));
}

export function registerRoutes(app: FastiyServer): void {
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
}
