import test from "node:test";
import assert from "node:assert/strict";
import { createAuthService } from "../src/modules/auth/auth.service.js";
import { login as loginSchema, signup as signupSchema } from "../src/modules/auth/auth.validation.js";
import { hasExpectedAudience, isSessionCurrent } from "../src/common/utils/security/token.security.js";
import { UserModel } from "../src/DB/models/user.model.js";
import { RoleEnum } from "../src/common/enums/user.enum.js";

const notFoundException = ({ message }) => new Error(message);

test("login only queries confirmed system accounts and keeps its failure generic", async () => {
  let query;
  const service = createAuthService({
    findOne: async (input) => { query = input; return null; },
    notFoundException,
  });

  await assert.rejects(service.login({ email: "person@example.com", password: "Secret1!" }), /invalid login/);
  assert.deepEqual(query.filter, {
    email: "person@example.com",
    confirmEmail: { $exists: true },
    provider: 2,
  });
});

test("password reset consumes the OTP and invalidates all earlier sessions", async () => {
  const account = {
    password: "old-hash",
    sessionVersion: 4,
    saveCalls: 0,
    async save() { this.saveCalls += 1; },
  };
  let otpInput;
  const service = createAuthService({
    findOne: async () => account,
    generateHash: async ({ plainText }) => `hash:${plainText}`,
    verifyOtp: async (input) => { otpInput = input; return true; },
    notFoundException,
  });

  await service.resetForgotPasswordCode({ email: "person@example.com", otp: "123456", password: "NewSecret1!" });
  assert.equal(account.password, "hash:NewSecret1!");
  assert.equal(account.sessionVersion, 5);
  assert.equal(account.saveCalls, 1);
  assert.equal(otpInput.consume, true);
});

test("session-version validation rejects a token created before a password reset", () => {
  assert.equal(isSessionCurrent({ sv: 4 }, { sessionVersion: 5 }), false);
  assert.equal(isSessionCurrent({ sv: 5 }, { sessionVersion: 5 }), true);
  assert.equal(isSessionCurrent({}, {}), true);
});

test("token audience must match both the token type and account role", () => {
  assert.equal(hasExpectedAudience(["access", 1], { tokenType: "access", audience: 1 }), true);
  assert.equal(hasExpectedAudience(["refresh", 1], { tokenType: "access", audience: 1 }), false);
  assert.equal(hasExpectedAudience(["access", 0], { tokenType: "access", audience: 1 }), false);
});

test("login validation requires a password", () => {
  const { error } = loginSchema.body.validate({ email: "person@example.com" });
  assert.ok(error);
});

test("auth validation normalizes email and rejects incomplete signup payloads", () => {
  const valid = signupSchema.body.validate({
    username: "Test User",
    email: "  TEST@EXAMPLE.COM  ",
    password: "StrongPass1!",
    confirmPassword: "StrongPass1!",
    phone: "+201234567890",
  });
  assert.equal(valid.error, undefined);
  assert.equal(valid.value.email, "test@example.com");
  assert.ok(signupSchema.body.validate({ username: "Test User", email: "test@example.com" }).error);
});

test("new users receive the least-privileged role by default", () => {
  const user = new UserModel({
    firstName: "Test", lastName: "User", email: "test@example.com", password: "hash",
  });
  assert.equal(user.role, RoleEnum.User);
});
