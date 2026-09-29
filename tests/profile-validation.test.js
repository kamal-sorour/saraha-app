import test from "node:test";
import assert from "node:assert/strict";
import { updateProfile, userId } from "../src/modules/user/user.validation.js";

test("profile update accepts only the supported public profile fields", () => {
  const valid = updateProfile.body.validate({ firstName: "Kimo", gender: 1 });
  assert.equal(valid.error, undefined);

  const invalid = updateProfile.body.validate({ password: "attacker-controlled" });
  assert.ok(invalid.error);
});

test("profile route identifier must be a Mongo ObjectId", () => {
  assert.equal(userId.params.validate({ userId: "0123456789abcdef01234567" }).error, undefined);
  assert.ok(userId.params.validate({ userId: "not-an-id" }).error);
});