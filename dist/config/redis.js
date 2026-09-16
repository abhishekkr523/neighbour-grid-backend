"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.redis = void 0;
exports.createRedisConnection = createRedisConnection;
const ioredis_1 = __importDefault(require("ioredis"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const REDIS_HOST = process.env.REDIS_HOST || "localhost";
const REDIS_PORT = Number(process.env.REDIS_PORT) || 6379;
// Shared IORedis connection for general use
exports.redis = new ioredis_1.default({
    host: REDIS_HOST,
    port: REDIS_PORT,
    maxRetriesPerRequest: null, // Required by BullMQ
});
exports.redis.on("connect", () => {
    console.log("✅ Connected to Redis");
});
exports.redis.on("error", (err) => {
    console.error("❌ Redis connection error:", err.message);
});
// Factory: create a new IORedis connection for BullMQ workers
// (BullMQ requires a dedicated connection per worker)
function createRedisConnection() {
    return new ioredis_1.default({
        host: REDIS_HOST,
        port: REDIS_PORT,
        maxRetriesPerRequest: null,
    });
}
