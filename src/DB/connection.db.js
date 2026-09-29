import mongoose from "mongoose";
import { DB_URI } from "./../../config/config.service.js";
import { logger } from "../common/utils/logger.js";

export const authenticateDB = async () => {
  if (!DB_URI) throw new Error("DB_URI is required");
  await mongoose.connect(DB_URI, { serverSelectionTimeoutMS: 30000 });
  logger.info("mongodb_connected");
};
