import express from "express";
import cors from "cors";
import helmet from "helmet";
import mongoose from "mongoose";
import swaggerUi from "swagger-ui-express";
import { authenticateDB } from "./DB/connection.db.js";
import { closeRedis, connectRedis, redisClient } from "./DB/redis.connection.db.js";
import { userRouter, authRouter, messageRouter } from "./modules/index.js";
import { globalErrorHandling } from "./common/utils/response/error.response.js";
import { logger } from "./common/utils/logger.js";
import { requestContext } from "./middleware/request-context.middleware.js";
import { limiter } from "./middleware/limiter.js";
import { closeEmailQueue, startEmailWorker } from "./common/utils/email/email.queue.js";
import { openApiDocument } from "./docs/openapi.js";
import { assertConfig, ORIGINS } from "../config/config.service.js";
import "./common/utils/security/encryption.security.js";

const corsOptions = {
  origin: ORIGINS,
  optionsSuccessStatus: 200,
};

export async function bootstrap() {
  assertConfig();
  await connectRedis();
  await authenticateDB();
  startEmailWorker();

  const app = express();
  const port = Number(process.env.PORT ?? 3000);
  const trustProxy = process.env.TRUST_PROXY_HOPS;
  if (trustProxy) app.set("trust proxy", Number(trustProxy));

  app.disable("x-powered-by");
  app.use(requestContext);
  app.use(cors(corsOptions));
  app.use(helmet());
  app.use(limiter);
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));
  app.use("/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

  app.get("/health/live", (req, res) => res.status(200).json({ status: "ok", requestId: req.id }));
  app.get("/health/ready", (req, res) => {
    const ready = mongoose.connection.readyState === 1 && redisClient.isReady;
    return res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "unavailable", requestId: req.id });
  });
  app.get("/", (req, res) => res.send("Saraha API"));

  app.use("/auth", authRouter);
  app.use("/user", userRouter);
  app.use("/message", messageRouter);

  app.use((req, res) => res.status(404).json({ error: "Route not found", requestId: req.id }));
  app.use(globalErrorHandling);

  const server = await new Promise((resolveServer, reject) => {
    const httpServer = app.listen(port, () => resolveServer(httpServer));
    httpServer.once("error", reject);
    httpServer.requestTimeout = 30_000;
    httpServer.headersTimeout = 15_000;
  });
  logger.info("http_server_started", { port });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info("shutdown_started", { signal });
    server.close(async (error) => {
      if (error) logger.error("http_server_close_failed", { errorName: error.name });
      await Promise.allSettled([closeEmailQueue(), closeRedis(), mongoose.disconnect()]);
      process.exitCode = error ? 1 : 0;
    });
  };
  process.once("SIGTERM", shutdown);
  process.once("SIGINT", shutdown);

  return { app, server, shutdown };
}

export default bootstrap;
