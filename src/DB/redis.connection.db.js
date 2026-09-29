import { createClient } from "redis";
import { RUDIS_URI } from "../../config/config.service.js";
import { logger } from "../common/utils/logger.js";

export const redisClient = createClient({ url: RUDIS_URI });
redisClient.on("error", (error) => logger.error("redis_client_error", { errorName: error.name }));

export const connectRedis = async () => {
  if (redisClient.isOpen) return;
  await redisClient.connect();
  logger.info("redis_connected");
};

export const closeRedis = async () => {
  if (redisClient.isOpen) await redisClient.quit();
};