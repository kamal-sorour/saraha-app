import test from "node:test";
import assert from "node:assert/strict";
import {
  createOtpService,
  OTP_MAX_FAILURES,
  OTP_MAX_SENDS,
  OTP_TTL_SECONDS,
  OTP_WINDOW_SECONDS,
  otpKeys,
} from "../src/modules/auth/otp.service.js";
import { EmailEnum } from "../src/common/enums/index.js";

class FakeRedis {
  data = new Map();
  now = 1_000_000;

  entry(key) {
    const entry = this.data.get(key);
    if (entry?.expiresAt !== null && entry?.expiresAt <= this.now) {
      this.data.delete(key);
      return undefined;
    }
    return entry;
  }

  get(key) {
    return this.entry(key)?.value ?? null;
  }

  ttl(key) {
    const entry = this.entry(key);
    if (!entry) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - this.now) / 1000);
  }

  set(key, value, seconds) {
    this.data.set(key, { value, expiresAt: seconds ? this.now + seconds * 1000 : null });
  }

  increment(key) {
    const current = Number(this.get(key) ?? 0);
    const ttl = this.ttl(key);
    this.set(key, current + 1, ttl > 0 ? ttl : undefined);
    return current + 1;
  }

  async eval(script, { keys, arguments: args }) {
    if (script.includes("local blockedTtl")) {
      const [codeKey, requestKey, failuresKey, blockedKey] = keys;
      const blockedTtl = this.ttl(blockedKey);
      if (blockedTtl > 0) return [-1, blockedTtl];
      const codeTtl = this.ttl(codeKey);
      if (codeTtl > 0) return [0, codeTtl];
      const sends = this.increment(requestKey);
      if (sends === 1) this.set(requestKey, sends, Number(args[1]));
      if (sends > Number(args[2])) {
        this.set(blockedKey, "1", Number(args[3]));
        this.data.delete(requestKey);
        return [-1, Number(args[3])];
      }
      this.set(codeKey, args[0], Number(args[4]));
      this.data.delete(failuresKey);
      return [1, Number(args[4])];
    }

    if (script.includes("local failures = redis.call('INCR'")) {
      const [codeKey, failuresKey, blockedKey] = keys;
      if (!this.entry(codeKey)) return 0;
      const failures = this.increment(failuresKey);
      if (failures === 1) this.set(failuresKey, failures, Number(args[1]));
      if (failures >= Number(args[0])) {
        this.data.delete(codeKey);
        this.data.delete(failuresKey);
        this.set(blockedKey, "1", Number(args[2]));
        return -1;
      }
      return failures;
    }

    if (script.includes("redis.call('GET', KEYS[1]) ~= ARGV[1]")) {
      const [codeKey, failuresKey] = keys;
      if (this.get(codeKey) !== args[0]) return 0;
      this.data.delete(codeKey);
      this.data.delete(failuresKey);
      return 1;
    }

    if (script.includes("redis.call('GET', KEYS[1]) == ARGV[1]")) {
      if (this.get(keys[0]) === args[0]) this.data.delete(keys[0]);
      return 1;
    }

    throw new Error("Unexpected Redis script in test");
  }
}

const setup = () => {
  const redis = new FakeRedis();
  const sentEmails = [];
  const service = createOtpService({
    redis,
    hash: async ({ plainText }) => `hash:${plainText}`,
    compare: async ({ plainText, cipherText }) => cipherText === `hash:${plainText}`,
    enqueue: async (email) => sentEmails.push(email),
  });
  return { redis, sentEmails, service };
};

const extractCode = (email) => email.text.match(/\b\d{6}\b/)[0];

test("OTP is issued once per active code and consumed atomically", async () => {
  const { redis, sentEmails, service } = setup();
  const email = "person@example.com";

  await service.issue({ email });
  assert.equal(sentEmails.length, 1);
  await assert.rejects(service.issue({ email }), /already sent/);

  const otp = extractCode(sentEmails[0]);
  assert.equal(await service.verify({ email, otp, consume: true }), true);
  await assert.rejects(service.verify({ email, otp, consume: true }), /expired or invalid|already been used/);
  assert.equal(redis.ttl(otpKeys({ email }).code), -2);
});

test("OTP locks after the configured number of incorrect attempts", async () => {
  const { service, sentEmails } = setup();
  const email = "person@example.com";
  await service.issue({ email });

  for (let attempt = 1; attempt < OTP_MAX_FAILURES; attempt += 1) {
    await assert.rejects(service.verify({ email, otp: "000000" }), /expired or invalid/);
  }
  await assert.rejects(service.verify({ email, otp: "000000" }), /Too many invalid OTP attempts/);
  await assert.rejects(service.issue({ email }), /Too many OTP requests/);
  assert.equal(sentEmails.length, 1);
});

test("OTP issuance is capped within the request window", async () => {
  const { redis, service, sentEmails } = setup();
  const email = "person@example.com";

  for (let request = 0; request < OTP_MAX_SENDS; request += 1) {
    await service.issue({ email });
    const currentEmail = sentEmails.at(-1);
    await service.verify({ email, otp: extractCode(currentEmail), consume: true });
  }
  await assert.rejects(service.issue({ email }), /Too many OTP requests/);
  assert.equal(sentEmails.length, OTP_MAX_SENDS);
  assert.ok(redis.ttl(otpKeys({ email }).blocked) > 0);
  assert.equal(redis.ttl(otpKeys({ email }).requests), -2);
  assert.equal(OTP_WINDOW_SECONDS, 300);
});

test("OTP keys are isolated by purpose and normalized email", () => {
  assert.notEqual(
    otpKeys({ email: "Person@Example.com", type: EmailEnum.ConfirmEmail }).code,
    otpKeys({ email: "person@example.com", type: EmailEnum.ForgotPassword }).code,
  );
  assert.equal(
    otpKeys({ email: "Person@Example.com" }).code,
    otpKeys({ email: "person@example.com" }).code,
  );
});
