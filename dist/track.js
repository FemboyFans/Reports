import client from "./client.js";
import Redis from "./redis.js";
function ipv6ToSubnet(ipv6) {
    const parts = ipv6.split(":");
    return `${parts.slice(0, 4).join(":")}::`;
}
export async function logPostView(post_id, ip_address) {
    if (ip_address.includes(".")) {
        ip_address = `::ffff:${ip_address}`;
    }
    else {
        ip_address = ipv6ToSubnet(ip_address);
    }
    if (await checkDuplicate(post_id, ip_address)) {
        console.log("duplicate view");
        return false;
    }
    const r = await client.insert({
        table: "post_views",
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
export async function getPostViewRank(dates, limit = 50) {
    const r = await client.query({
        query: "SELECT post_id, COUNT(*) as view_count FROM post_views WHERE date IN ({dates:Array(Date)}) GROUP BY post_id ORDER BY view_count DESC LIMIT {limit:UInt64}",
        query_params: { dates, limit },
        format: "JSON"
    });
    return (await r.json()).data.map(v => [Number(v.post_id), Number(v.view_count)]);
}
function getDate() {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}
function getEndOfDay() {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
}
// expects an already formatted ip_address
async function checkDuplicate(post_id, ip_address) {
    const v = await Redis.get(`post_views:${post_id}:${ip_address}`);
    if (v === null) {
        // double check
        return checkPostView(post_id, ip_address);
    }
    return true;
}
// expects an already formatted ip_address
export async function checkPostView(post_id, ip_address) {
    const r = await client.query({
        query: "SELECT 1 FROM post_views WHERE post_id = {post_id:UInt64} AND ip_address = {ip_address:IPv6} AND date = today() LIMIT 1",
        query_params: { post_id, ip_address },
        format: "JSON"
    });
    return ((await r.json()).rows ?? 0) !== 0;
}
export async function getViewCount(post_id, date) {
    const r = await Redis.get(`post_views:${post_id}${date ? `:${date}` : ""}`);
    if (r !== null) {
        return Number(r);
    }
    const q = await client.query({
        query: `SELECT COUNT(*) FROM post_views WHERE post_id = {post_id:UInt64}${date ? " AND date = {date:Date}" : ""}`,
        query_params: { post_id, date },
        format: "JSON"
    });
    return Number((await q.json()).data[0]["COUNT()"]);
}
export async function logMissedSearch(tags, page) {
    const r = Redis.multi()
        .incr("missed_searches")
        .incr(`missed_searches:${getDate()}`);
    if (tags.length === 1) {
        r.incr(`missed_searches:${tags[0]}`);
        r.incr(`missed_searches:${tags[0]}:${getDate()}`);
    }
    await r.exec();
    const q = await client.insert({
        table: "missed_searches",
        values: [{ tags, page }],
        format: "JSONEachRow"
    });
    return q.executed;
}
export async function logSearch(tags, page) {
    const r = Redis.multi()
        .incr("searches")
        .incr(`searches:${getDate()}`);
    if (tags.length === 1) {
        r.incr(`searches:${tags[0]}`);
        r.incr(`searches:${tags[0]}:${getDate()}`);
    }
    await r.exec();
    const q = await client.insert({
        table: "post_searches",
        values: [{ tags, page }],
        format: "JSONEachRow"
    });
    return q.executed;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi9zcmMvdHJhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxNQUFNLE1BQU0sYUFBYSxDQUFDO0FBQ2pDLE9BQU8sS0FBSyxNQUFNLFlBQVksQ0FBQztBQUUvQixTQUFTLFlBQVksQ0FBQyxJQUFZO0lBQzlCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDOUIsT0FBTyxHQUFHLEtBQUssQ0FBQyxLQUFLLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQzlDLENBQUM7QUFDRCxNQUFNLENBQUMsS0FBSyxVQUFVLFdBQVcsQ0FBQyxPQUFlLEVBQUUsVUFBa0I7SUFDakUsSUFBSSxVQUFVLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUM7UUFDM0IsVUFBVSxHQUFHLFVBQVUsVUFBVSxFQUFFLENBQUM7SUFDeEMsQ0FBQztTQUFNLENBQUM7UUFDSixVQUFVLEdBQUcsWUFBWSxDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxJQUFJLE1BQU0sY0FBYyxDQUFDLE9BQU8sRUFBRSxVQUFVLENBQUMsRUFBRSxDQUFDO1FBQzVDLE9BQU8sQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUM5QixPQUFPLEtBQUssQ0FBQztJQUNqQixDQUFDO0lBQ0QsTUFBTSxDQUFDLEdBQUcsTUFBTSxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQzFCLEtBQUssRUFBRyxZQUFZO1FBQ3BCLE1BQU0sRUFBRSxDQUFDLEVBQUUsT0FBTyxFQUFFLFVBQVUsRUFBRSxDQUFDO1FBQ2pDLE1BQU0sRUFBRSxhQUFhO0tBQ3hCLENBQUMsQ0FBQztJQUNILE1BQU0sS0FBSyxDQUFDLEtBQUssRUFBRTtTQUNkLEdBQUcsQ0FBQyxjQUFjLE9BQU8sSUFBSSxV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