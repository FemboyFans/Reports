import client from "./client.js";
import Redis from "./redis.js";

function ipv6ToSubnet(ipv6: string): string {
    const parts = ipv6.split(":");
    return `${parts.slice(0, 4).join(":")}::`;
}
export async function logPostView(post_id: number, ip_address: string): Promise<boolean> {
    if (ip_address.includes(".")) {
        ip_address = `::ffff:${ip_address}`;
    } else {
        ip_address = ipv6ToSubnet(ip_address);
    }

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

export async function getPostViewRank(dates: Array<string>, limit = 50): Promise<Array<{ count: number; post: number; }>> {
    const r = await client.query({
        query:        "SELECT post_id, COUNT(*) as view_count FROM post_views WHERE date IN ({dates:Array(Date)}) GROUP BY post_id ORDER BY view_count DESC LIMIT {limit:UInt64}",
        query_params: { dates, limit },
        format:       "JSON"
    });

    return (await r.json<{ post_id: string; view_count: string; }>()).data.map(v => ({ post: Number(v.post_id), count: Number(v.view_count) }));
}

export async function getPostViewsBulk(posts: Array<number>, date?: string): Promise<Array<{ count: number; post: number; }>> {
    const r = await client.query({
        query:        `SELECT post_id, COUNT(*) as view_count FROM post_views WHERE post_id IN ({posts:Array(UInt64)})${date ? " AND date = {date:Date}" : ""} GROUP BY post_id LIMIT 100`,
        query_params: { posts, date },
        format:       "JSON"
    });

    return (await r.json<{ post_id: string; view_count: string; }>()).data.map(v => ({ post: Number(v.post_id), count: Number(v.view_count) }));
}

function getDate(): string {
    const d = new Date();
    return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function getEndOfDay(): number {
    const d = new Date();
    d.setHours(23, 59, 59, 999);
    return d.getTime();
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
export async function checkPostView(post_id: number, ip_address: string): Promise<boolean> {
    const r = await client.query({
        query:        "SELECT 1 FROM post_views WHERE post_id = {post_id:UInt64} AND ip_address = {ip_address:IPv6} AND date = today() LIMIT 1",
        query_params: { post_id, ip_address },
        format:       "JSON"
    });
    return ((await r.json()).rows ?? 0) !== 0;
}

export async function getViewCount(post_id: number, date?: string): Promise<number> {
    const r = await Redis.get(`post_views:${post_id}${date ? `:${date}` : ""}`);
    if (r !== null) {
        return Number(r);
    }
    const q = await client.query({
        query:        `SELECT COUNT(*) FROM post_views WHERE post_id = {post_id:UInt64}${date ? " AND date = {date:Date}" : ""}`,
        query_params: { post_id, date },
        format:       "JSON"
    });
    return Number((await q.json<Record<"COUNT()", string>>()).data[0]["COUNT()"]);
}

export async function logMissedSearch(tags: Array<string>, page: number): Promise<boolean> {
    const r = Redis.multi()
        .incr("missed_searches")
        .incr(`missed_searches:${getDate()}`);
    if (tags.length === 1) {
        r.incr(`missed_searches:${tags[0]}`);
        r.incr(`missed_searches:${tags[0]}:${getDate()}`);
    }
    await r.exec();

    const q = await client.insert({
        table:  "missed_searches",
        values: [{ tags, page }],
        format: "JSONEachRow"
    });
    return q.executed;
}

export async function getMissedSearchRank(dates: Array<string>, limit = 50): Promise<Array<{ count: number; tag: string; }>> {
    const r = await client.query({
        query:        "SELECT tags, COUNT(*) as count FROM missed_searches WHERE date IN ({dates:Array(Date)}) AND length(tags) = 1 GROUP BY tags ORDER BY count DESC LIMIT {limit:UInt64}",
        query_params: { dates, limit },
        format:       "JSON"
    });

    return (await r.json<{ count: string; tags: Array<string>; }>()).data.map(v => ({ tag: v.tags[0], count: Number(v.count) }));
}

export async function logSearch(tags: Array<string>, page: number): Promise<boolean> {
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

export async function getSearchRank(dates: Array<string>, limit = 50): Promise<Array<{ count: number; tag: string; }>> {
    const r = await client.query({
        query:        "SELECT tags, COUNT(*) as count FROM post_searches WHERE date IN ({dates:Array(Date)}) AND length(tags) = 1 GROUP BY tags ORDER BY count DESC LIMIT {limit:UInt64}",
        query_params: { dates, limit },
        format:       "JSON"
    });

    return (await r.json<{ count: string; tags: Array<string>; }>()).data.map(v => ({ tag: v.tags[0], count: Number(v.count) }));
}
