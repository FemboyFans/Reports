import Config from "./config.js";
import { createClient } from "@clickhouse/client";

const client = createClient({
    url: Config.clickhouseURL
});
export default client;
