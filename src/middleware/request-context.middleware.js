import { randomUUID } from "node:crypto";
import { logger } from "../common/utils/logger.js";

export const requestContext = (req, res, next) => {
  req.id = randomUUID();
  const startedAt = performance.now();
  res.setHeader("X-Request-Id", req.id);
  res.once("finish", () => logger.info("http_request", {
    requestId: req.id,
    method: req.method,
    path: req.path,
    statusCode: res.statusCode,
    durationMs: Math.round(performance.now() - startedAt),
  }));
  next();
};