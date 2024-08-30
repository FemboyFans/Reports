import "dotenv/config";
const env = <R extends boolean = false>(key: string, required?: R): R extends true ? string : string | undefined => {
    const v = process.env[key];
    if (!v && required) {
        throw new Error(`Missing required environment variable: ${key}`);
    }
    return v as never;
};

const Config = {
    clickhouseURL: env("CLICKHOUSE_URL") ?? "http://clickhouse:8123",
    redisURL:      env("REDIS_URL") ?? "redis://redis:6379",
    secretKey:     env("SECRET_KEY", true),
    migrationDir:  env("MIGRATION_DIR") ?? new URL("../migrations", import.meta.url).pathname
};
export default Config;
