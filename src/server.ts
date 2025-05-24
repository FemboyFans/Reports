import Config from "./config.js";
import { registerRoutes as registerPostViewsRoutes } from "./track/postViews.js";
import { registerRoutes as registerSearchesRoutes } from "./track/searches.js";
import { registerRoutes as registerMissedSearchesRoutes } from "./track/missedSearches.js";
import { registerRoutes as registerApiKeyUsagesRoutes } from "./track/apiKeyUsages.js";
import client from "./client.js";
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

export type FastiyServer = typeof app;

registerApiKeyUsagesRoutes(app);
registerMissedSearchesRoutes(app);
registerPostViewsRoutes(app);
registerSearchesRoutes(app);

app.get("/up", async(_request, reply) => reply.status(204).send());
app.get("/stats", async(_request, reply) => {
    const date = new Date().toISOString();
    const dbDate = (await (await client.query({
        query:  "SELECT UTC_timestamp() as date",
        format: "JSON"
    })).json<{ date: string; }>()).data[0].date;
    const viewCount = Number((await (await client.query({
        query:  "SELECT COUNT(*) as count FROM post_views",
        format: "JSON"
    })).json<{ count: string; }>()).data[0].count);
    const searchCount = Number((await (await client.query({
        query:  "SELECT COUNT(*) as count FROM post_searches",
        format: "JSON"
    })).json<{ count: string; }>()).data[0].count);
    const missedSearchCount = Number((await (await client.query({
        query:  "SELECT COUNT(*) as count FROM missed_searches",
        format: "JSON"
    })).json<{ count: string; }>()).data[0].count);
    const schemaVersion = Number((await (await client.query({
        query:  "SELECT version FROM versions ORDER BY version DESC LIMIT 1",
        format: "JSON"
    })).json<{ version: string; }>()).data[0].version);
    const dbVersion = (await (await client.query({
        query:  "SELECT value as version FROM system.build_options WHERE name = 'VERSION_DESCRIBE'",
        format: "JSON"
    })).json<{ version: string; }>()).data[0].version;
    const ping = await client.ping();
    const start = process.hrtime.bigint();
    await client.query({
        query:  "SELECT 1",
        format: "JSON"
    });
    const end = process.hrtime.bigint();
    const latency = Math.round(Number(end - start) / 1e6 * 100) / 100;
    return reply.status(200).send({
        date,
        dbDate,
        viewCount,
        searchCount,
        missedSearchCount,
        schemaVersion,
        dbVersion,
        latency,
        healthy: ping.success,
        error:   ping.success ? null : `${ping.error.name}: ${ping.error.message}`
    });
});

await app.listen({
    host: "0.0.0.0",
    port: 3000
});
