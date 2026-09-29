import { Queue, Worker } from "bullmq";
import { RUDIS_URI } from "../../../../config/config.service.js";
import { decrypt, encrypt } from "../security/encryption.security.js";
import { sendEmail } from "./send.email.js";
import { logger } from "../logger.js";

let queue;
let worker;

const getQueue = () => {
  if (queue) return queue;
  const redisUrl = new URL(RUDIS_URI);
  const connection = {
    host: redisUrl.hostname,
    port: Number(redisUrl.port || (redisUrl.protocol === "rediss:" ? 6380 : 6379)),
    db: Number(redisUrl.pathname.slice(1) || 0),
    maxRetriesPerRequest: null,
    ...(redisUrl.username ? { username: decodeURIComponent(redisUrl.username) } : {}),
    ...(redisUrl.password ? { password: decodeURIComponent(redisUrl.password) } : {}),
    ...(redisUrl.protocol === "rediss:" ? { tls: {} } : {}),
  };
  queue = new Queue("transactional-email", { connection });
  return queue;
};

export const enqueueEmail = async (message) => {
  const encryptedPayload = encrypt(JSON.stringify(message));
  return getQueue().add("send", { encryptedPayload }, {
    attempts: 5,
    backoff: { type: "exponential", delay: 1_000 },
    removeOnComplete: 1_000,
    removeOnFail: 100,
  });
};

export const startEmailWorker = () => {
  if (worker) return worker;
  const queueConnection = getQueue().opts.connection;
  worker = new Worker("transactional-email", async (job) => {
    const message = JSON.parse(decrypt(job.data.encryptedPayload));
    await sendEmail(message);
  }, { connection: queueConnection, concurrency: 5 });

  worker.on("completed", (job) => logger.info("email_job_completed", { jobId: job.id }));
  worker.on("failed", (job, error) => logger.error("email_job_failed", {
    jobId: job?.id,
    attemptsMade: job?.attemptsMade,
    errorName: error.name,
  }));
  return worker;
};

export const closeEmailQueue = async () => {
  await Promise.allSettled([worker?.close(), queue?.close()]);
  queue = undefined;
  worker = undefined;
};
