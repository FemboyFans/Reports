import "dotenv/config";
declare const Config: {
    clickhouseURL: string;
    redisURL: string;
    secretKey: string;
    migrationFolder: string;
};
export default Config;
