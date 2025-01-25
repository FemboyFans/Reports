import { convertIPAddress, toDateOnly, unconvertIPAddress } from "./common.js";
import client from "../client.js";
import type { FastiyServer } from "../server.js";
import { verify } from "../bodyHandler.js";

async function logApiKeyUsage(key_id: number, controller: string, action: string, method: string, request_uri: string, ip_address: string): Promise<boolean> {
    ip_address = convertIPAddress(ip_address);
    const r = await client.insert({
        table:  "api_key_usages",
        values: [{ key_id, controller, action, method, request_uri, ip_address }],
        format: "JSONEachRow"
    });
    return r.executed;
}


async function getApiKeyUsages(key_id: number, dates?: Array<string>, limit = 100, page = 1): Promise<Array<{ action: string; controller: string; date: string; ip_address: string; method: string; request_uri: string; }>> {
    const r = await client.query({
        query:        `SELECT date, controller, action, method, request_uri, ip_address FROM api_key_usages WHERE key_id = {key_id:UInt32}${dates?.length ? " AND date IN ({dates:Array(Date)})" : ""} ORDER BY date DESC LIMIT {limit:UInt64} OFFSET {offset:UInt64}`,
        query_params: { key_id, dates, limit, offset: (page - 1) * limit },
        format:       "JSON"
    });

    return (await r.json<{ action: string; controller: string; date: string; ip_address: string; method: string; request_uri: string; }>()).data.map(v => ({ action: v.action, controller: v.controller, date: toDateOnly(v.date), ip_address: unconvertIPAddress(v.ip_address), method: v.method, request_uri: v.request_uri }));
}

async function countApiKeyUsages(key_id: number, dates?: Array<string>): Promise<number> {
    const r = await client.query({
        query:        `SELECT COUNT(*) as count FROM api_key_usages WHERE key_id = {key_id:UInt32}${dates ? " AND date IN ({dates:Array(Date)})" : ""}`,
        query_params: { key_id, dates },
        format:       "JSON"
    });

    return Number((await r.json<{ count: string; }>()).data[0].count);
}


export function registerRoutes(app: FastiyServer): void {
    app.post("/api_key_usages", async (request, reply) => {
        if (!request.body || typeof request.body !== "object" || !("msg" in request.body)) {
            return reply.status(400).send({ error: "Invalid request body", success: false });
        }
        let msg: { action: string; controller: string; ip_address: string; key_id: number; method: string; request_uri: string; };
        try {
            msg = verify((request.body as Record<string, string>).msg as string, "api-key-usages");
        } catch (err) {
            return reply.status(400).send({ error: (err as Error).message, success: false });
        }
        const r = await logApiKeyUsage(msg.key_id, msg.controller, msg.action, msg.method, msg.request_uri, msg.ip_address);
        return reply.status(r ? 201 : 200).send({ success: true });
    });

    app.get("/api_key_usages/:id", async (request, reply) => {
        const params = request.params as Record<string, unknown>;
        const qparams = request.query as Record<string, unknown>;
        const id = Number(params.id);
        if (isNaN(id)) {
            return reply.status(400).send({ error: "Invalid api key ID", success: false });
        }
        const dates: Array<string> = [];
        if (qparams.date) {
            dates.push(qparams.date as string);
        }
        const limit = qparams.limit ? Number(qparams.limit) : 50;
        const page = qparams.page ? Number(qparams.page) : 1;

        const data = await getApiKeyUsages(id, dates, limit, page);
        const count = await countApiKeyUsages(id, dates);

        return reply.status(200).send({ count, data, success: true });
    });
}
