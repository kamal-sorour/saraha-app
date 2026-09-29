import test from "node:test";
import assert from "node:assert/strict";
import { createAuthRouter } from "../src/modules/auth/auth.controller.js";

// Exercise Router -> validation -> controller -> service without opening a TCP port.
// This keeps the test runnable in restricted CI sandboxes too.
const post = (router, path, body) => new Promise((resolve, reject) => {
  const req = { method: "POST", url: path, originalUrl: path, body, ip: "127.0.0.1" };
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(payload) { resolve({ status: this.statusCode, payload }); },
  };
  router.handle(req, res, (error) => {
    if (error) return resolve({ status: error.cause?.status ?? 500, error });
    return reject(new Error("Route completed without a response"));
  });
});

test("login route rejects a missing password before reaching the service", async () => {
  let called = false;
  const router = createAuthRouter({
    authService: { login: async () => { called = true; } },
    limiterLogin: (_req, _res, next) => next(),
    deleteLoginKey: async () => {},
  });

  const response = await post(router, "/login", { email: "person@example.com" });
  assert.equal(response.status, 400);
  assert.equal(called, false);
});

test("login route returns tokens only after the confirmed-account service flow succeeds", async () => {
  let input;
  const router = createAuthRouter({
    authService: {
      login: async (body) => {
        input = body;
        return { access_token: "access", refresh_token: "refresh" };
      },
    },
    limiterLogin: (_req, _res, next) => next(),
    deleteLoginKey: async () => {},
  });

  const response = await post(router, "/login", { email: "person@example.com", password: "StrongPass1!" });
  assert.equal(response.status, 200);
  assert.deepEqual(input, { email: "person@example.com", password: "StrongPass1!" });
  assert.deepEqual(response.payload.data, { access_token: "access", refresh_token: "refresh" });
});
