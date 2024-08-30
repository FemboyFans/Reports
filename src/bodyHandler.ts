import Config from "./config.js";
import { createHmac } from "node:crypto";

export function verify<T = string>(msg: string, purpose?: string): T {
    const [payload, signature] = msg.split("--");
    const expected = createHmac("sha256", Config.secretKey).update(payload).digest("hex");

    if (signature !== expected) {
        throw new Error("Invalid signature");
    }

    const data = JSON.parse(Buffer.from(payload, "base64").toString("utf8")) as { _rails: { data: T; pur: string; }; };
    if (data._rails.pur !== purpose) {
        throw new Error("Invalid purpose");
    }

    return data._rails.data;
}
