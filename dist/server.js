import { getPostViewRank, getViewCount, logMissedSearch, logPostView, logSearch } from "./track.js";
import Config from "./config.js";
import Fastify from "fastify";
import FastifyMiddleware from "@fastify/middie";
import FastifyJWT from "@fastify/jwt";
const app = await Fastify({
    logger: true
});
await app.register(FastifyMiddleware);
await app.register(FastifyJWT, {
    secret: Config.secretKey,
    decode: { complete: true },
    verify: { allowedIss: "FemboyFans", allowedAud: "reports" }
});
app.addHook("onRequest", async (request, reply) => {
    try {
        /* await request.jwtVerify<JwtPayload>({
            verify: {
                allowedSub: request.url
            },
            decode: {}
        }); */
    }
    catch (error) {
        return reply.send(error);
    }
});
app.get("/views/rank", async (request, reply) => {
    const qparams = request.query;
    const dates = [];
    if (qparams.date) {
        dates.push(qparams.date);
    }
    else {
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
    return reply.status(200).send({ data: await getPostViewRank(dates, limit), success: true });
});
app.get("/views/:id", async (request, reply) => {
    const params = request.params;
    const qparams = request.query;
    const id = Number(params.id);
    if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid post ID", success: false });
    }
    const res = await getViewCount(id, qparams.date);
    return reply.status(200).send({ data: res, success: true });
});
app.post("/views/:id", async (request, reply) => {
    const id = Number(request.params.id);
    if (isNaN(id)) {
        return reply.status(400).send({ error: "Invalid post ID", success: false });
    }
    const ip = request.ip;
    const r = await logPostView(id, ip);
    return reply.status(r ? 201 : 200).send({ success: true });
});
app.post("/searches", async (request, reply) => {
    const body = request.body;
    if (!Array.isArray(body.tags) || typeof body.page !== "number") {
        return reply.status(400).send({ error: "Invalid request body", success: false });
    }
    const r = await logSearch(body.tags, body.page);
    return reply.status(r ? 201 : 200).send({ success: true });
});
app.post("/searches/missed", async (request, reply) => {
    const body = request.body;
    if (!Array.isArray(body.tags) || typeof body.page !== "number") {
        return reply.status(400).send({ error: "Invalid request body", success: false });
    }
    const r = await logMissedSearch(body.tags, body.page);
    return reply.status(r ? 201 : 200).send({ success: true });
});
await app.listen(3005, "127.0.0.1");
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vc3JjL3NlcnZlci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQ0gsZUFBZSxFQUNmLFlBQVksRUFDWixlQUFlLEVBQ2YsV0FBVyxFQUNYLFNBQVMsRUFDWixNQUFNLFlBQVksQ0FBQztBQUNwQixPQUFPLE1BQU0sTUFBTSxhQUFhLENBQUM7QUFDakMsT0FBTyxPQUFPLE1BQU0sU0FBUyxDQUFDO0FBQzlCLE9BQU8saUJBQWlCLE1BQU0saUJBQWlCLENBQUM7QUFDaEQsT0FBTyxVQUFVLE1BQU0sY0FBYyxDQUFDO0FBR3RDLE1BQU0sR0FBRyxHQUFHLE1BQU0sT0FBTyxDQUFDO0lBQ3RCLE1BQU0sRUFBRSxJQUFJO0NBQ2YsQ0FBQyxDQUFDO0FBQ0gsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLGlCQUFpQixDQUFDLENBQUM7QUFDdEMsTUFBTSxHQUFHLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRTtJQUMzQixNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVM7SUFDeEIsTUFBTSxFQUFFLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRTtJQUMxQixNQUFNLEVBQUUsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLFVBQVUsRUFBRSxTQUFTLEVBQUU7Q0FDOUQsQ0FBQyxDQUFDO0FBRUgsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxLQUFLLEVBQUUsRUFBRTtJQUM5QyxJQUFJLENBQUM7UUFDRDs7Ozs7Y0FLTTtJQUNWLENBQUM7SUFBQyxPQUFPLEtBQUssRUFBRSxDQUFDO1FBQ2IsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQzdCLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQztBQUVILEdBQUcsQ0FBQyxHQUFHLENBQUMsYUFBYSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsS0FBSyxFQUFFLEVBQUU7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