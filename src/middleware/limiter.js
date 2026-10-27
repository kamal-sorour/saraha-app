import { createHash } from "node:crypto";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";
import { RedisStore } from "rate-limit-redis";
import { redisClient } from "../DB/redis.connection.db.js";

const redisStore = (prefix) => {
  let store;
  let options;
  let initialization;
  const initialize = async () => {
    if (!redisClient.isReady) throw new Error("Redis is not ready for rate limiting");
    store ??= new RedisStore({
      prefix,
      sendCommand: (...args) => redisClient.sendCommand(args),
    });
    initialization ??= Promise.resolve(store.init(options));
    await initialization;
  };

  return {
    init(configuration) { options = configuration; },
    async increment(key) { await initialize(); return store.increment(key); },
    async decrement(key) { await initialize(); return store.decrement(key); },
    async resetKey(key) { await initialize(); return store.resetKey(key); },
    async get(key) { await initialize(); return store.get(key); },
  };
};

const loginKey = (req) => {
  const ip = ipKeyGenerator(req.ip ?? "0.0.0.0", 56);
  const email = String(req.body?.email ?? "unknown").trim().toLowerCase();
  const accountKey = createHash("sha256").update(email).digest("hex");
  return `${ip}:${accountKey}`;
};

export const limiter = rateLimit({
  windowMs: 2 * 60 * 1000,
  limit: 120,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  store: redisStore("api:"),
  handler: (req, res) => res.status(429).json({ message: "Too many requests", requestId: req.id }),
});

export const limiterLogin = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: loginKey,
  store: redisStore("login:"),
  handler: (req, res) => res.status(429).json({ message: "Too many login attempts", requestId: req.id }),
});

export const limiterGoogle = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip ?? "0.0.0.0", 56),
  store: redisStore("google-login:"),
  handler: (req, res) => res.status(429).json({ message: "Too many Google sign-in attempts", requestId: req.id }),
});
