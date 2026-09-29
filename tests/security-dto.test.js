import test from "node:test";
import assert from "node:assert/strict";
import { toPublicUser } from "../src/modules/user/user.dto.js";
import { toPublicMessage } from "../src/modules/message/message.dto.js";
import { UserModel } from "../src/DB/models/user.model.js";

const key = Buffer.alloc(32, 7).toString("base64");
process.env.ENC_KEY_BASE64 = key;
const { encrypt, decrypt } = await import("../src/common/utils/security/encryption.security.js");

test("public user DTO never exposes credentials, email, or encrypted phone", () => {
  const dto = toPublicUser({
    _id: "0123456789abcdef01234567",
    firstName: "Test",
    lastName: "User",
    email: "private@example.com",
    password: "hashed-secret",
    oldPassword: ["old-hash"],
    phone: "encrypted-phone",
    profilePicture: "uploads/profile.png",
    gender: 1,
  });

  assert.equal(dto.username, "Test User");
  assert.equal(dto.profilePicture, "uploads/profile.png");
  assert.equal("email" in dto, false);
  assert.equal("password" in dto, false);
  assert.equal("oldPassword" in dto, false);
  assert.equal("phone" in dto, false);
});

test("Mongoose user serialization excludes private fields by default", () => {
  const user = new UserModel({
    firstName: "Test",
    lastName: "User",
    email: "private@example.com",
    password: "hashed-secret",
    oldPassword: ["old-hash"],
    phone: "encrypted-phone",
  });
  const serialized = user.toJSON();

  assert.equal("email" in serialized, false);
  assert.equal("password" in serialized, false);
  assert.equal("oldPassword" in serialized, false);
  assert.equal("phone" in serialized, false);
});

test("public message DTO never exposes sender or receiver identifiers", () => {
  const dto = toPublicMessage({
    _id: "0123456789abcdef01234567",
    senderId: "sender-secret",
    receiverId: "receiver-secret",
    content: "hello",
    attachments: ["uploads/messages/image.jpg"],
  });

  assert.equal(dto.content, "hello");
  assert.equal("senderId" in dto, false);
  assert.equal("receiverId" in dto, false);
});

test("AES-GCM encryption round-trips and detects tampering", () => {
  const encrypted = encrypt("+201234567890");
  assert.equal(decrypt(encrypted), "+201234567890");

  const parts = encrypted.split(":");
  parts[3] = Buffer.from("tampered").toString("base64");
  assert.throws(() => decrypt(parts.join(":")));
});
