import client from "./client.js";
import Config from "./config.js";
import { fileURLToPath } from "node:url";
import { readdir, readFile } from "node:fs/promises";

async function createVersionsTable(): Promise<void> {
    await client.query({ query: "CREATE TABLE IF NOT EXISTS versions (version UInt8) ENGINE = MergeTree() ORDER BY version" });
}

async function migrate(): Promise<void> {
    await createVersionsTable();
    const files = await readdir(Config.migrationDir);

    for (const file of files) {
        const version = Number(file.match(/^\d+/)![0]);
        const r = await client.query({ query: "SELECT version FROM versions WHERE version = {version:UInt8}", query_params: { version } });
        const exists = (await r.json()).data.length !== 0;
        if (!exists) {
            console.log("Migrating %d", version);
            const query = await readFile(`${Config.migrationDir}/${file}`, "utf8");
            await client.command({ query });
            await client.command({ query: "INSERT INTO versions (version) VALUES ({version:UInt8})", query_params: { version } });
        }
    }
}

if (import.meta.url.startsWith("file:") && process.argv[1] === fileURLToPath(import.meta.url)) {
    await migrate();
}
