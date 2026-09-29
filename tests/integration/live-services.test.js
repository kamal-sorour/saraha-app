import test from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";
import { createClient } from "redis";
import { createOtpService, otpKeys } from "../../src/modules/auth/otp.service.js";
import { EmailEnum } from "../../src/common/enums/index.js";
import { createMessageListService } from "../../src/modules/message/message.service.js";

const dbUri = process.env.TEST_DB_URI;
const redisUri = process.env.TEST_REDIS_URI;
const enabled = process.env.CONFIRM_TEST_SERVICES === "true" && Boolean(dbUri && redisUri);
const required = process.env.REQUIRE_LIVE_SERVICES === "true";

const assertTestDatabase = (uri) => {
  const database = new URL(uri).pathname.replace(/^\//, "");
  if (!/test/i.test(database)) {
    throw new Error("TEST_DB_URI must target a database whose name includes 'test'");
  }
};

test("live integration environment is explicitly configured", { skip: !required }, () => {
  assert.equal(enabled, true, "Set TEST_DB_URI, TEST_REDIS_URI, and CONFIRM_TEST_SERVICES=true");
  assertTestDatabase(dbUri);
});

test("live Redis executes the OTP Lua flow atomically", { skip: !enabled }, async (t) => {
  const redis = createClient({ url: redisUri });
  const email = `integration-${Date.now()}@example.com`;
  const keys = otpKeys({ email, type: EmailEnum.ConfirmEmail });
  const sent = [];
  t.after(async () => {
    await redis.del(Object.values(keys));
    if (redis.isOpen) await redis.quit();
  });
  await redis.connect();

  const otp = createOtpService({
    redis,
    hash: async ({ plainText }) => `hash:${plainText}`,
    compare: async ({ plainText, cipherText }) => cipherText === `hash:${plainText}`,
    enqueue: async (message) => sent.push(message),
  });
  await otp.issue({ email, type: EmailEnum.ConfirmEmail });
  const code = sent[0].text.match(/\b\d{6}\b/)[0];
  assert.equal(await otp.verify({ email, otp: code, type: EmailEnum.ConfirmEmail, consume: true }), true);
  await assert.rejects(otp.verify({ email, otp: code, type: EmailEnum.ConfirmEmail, consume: true }));
});

test("live MongoDB paginates messages with a stable cursor", { skip: !enabled }, async (t) => {
  assertTestDatabase(dbUri);
  const connection = await mongoose.createConnection(dbUri).asPromise();
  const collection = `integration_messages_${Date.now()}`;
  const schema = new mongoose.Schema({
    receiverId: mongoose.Schema.Types.ObjectId,
    senderId: mongoose.Schema.Types.ObjectId,
    content: String,
  }, { timestamps: true, collection });
  const model = connection.model(`IntegrationMessage${Date.now()}`, schema);
  t.after(async () => {
    await model.deleteMany({});
    await connection.close();
  });

  const userId = new mongoose.Types.ObjectId();
  const oldest = new Date("2026-09-20T10:00:00.000Z");
  const middle = new Date("2026-09-21T10:00:00.000Z");
  const newest = new Date("2026-09-22T10:00:00.000Z");
  await model.create([
    { receiverId: userId, content: "oldest", createdAt: oldest, updatedAt: oldest },
    { receiverId: userId, content: "middle", createdAt: middle, updatedAt: middle },
    { receiverId: userId, content: "newest", createdAt: newest, updatedAt: newest },
  ]);

  const service = createMessageListService({ model });
  const first = await service.getAllMessages({ _id: userId }, { limit: 2 });
  assert.deepEqual(first.messages.map(({ content }) => content), ["newest", "middle"]);
  assert.equal(first.pageInfo.hasMore, true);
  assert.equal("receiverId" in first.messages[0], false);

  const second = await service.getAllMessages({ _id: userId }, { limit: 2, cursor: first.pageInfo.nextCursor });
  assert.deepEqual(second.messages.map(({ content }) => content), ["oldest"]);
  assert.equal(second.pageInfo.hasMore, false);
});
