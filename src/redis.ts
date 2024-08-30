import Config from "./config.js";
import { Redis as IORedis } from "ioredis";

const Redis = new IORedis(Config.redisURL);
export default Redis;
