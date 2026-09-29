import test from "node:test";
import assert from "node:assert/strict";
import {
  createMessageListService,
  decodeMessageCursor,
  MAX_MESSAGE_PAGE_SIZE,
} from "../src/modules/message/message.service.js";
import { listMessages } from "../src/modules/message/message.validation.js";

const ids = [
  "0123456789abcdef01234561",
  "0123456789abcdef01234562",
  "0123456789abcdef01234563",
];

const createModel = (rows, seen) => ({
  find(filter) {
    seen.filter = filter;
    return {
      sort(value) { seen.sort = value; return this; },
      limit(value) { seen.limit = value; return this; },
      lean() { return this; },
      async exec() { return rows; },
    };
  },
});

test("message list uses a stable descending cursor and does not expose identifiers", async () => {
  const seen = {};
  const rows = ids.map((id, index) => ({
    _id: id,
    senderId: "sender-secret",
    receiverId: "receiver-secret",
    content: `message ${index}`,
    createdAt: new Date(`2026-09-2${9 - index}T12:00:00.000Z`),
  }));
  const service = createMessageListService({ model: createModel(rows, seen) });

  const page = await service.getAllMessages({ _id: "user-id" }, { limit: 2 });
  assert.deepEqual(seen.sort, { createdAt: -1, _id: -1 });
  assert.equal(seen.limit, 3);
  assert.equal(page.messages.length, 2);
  assert.equal(page.pageInfo.hasMore, true);
  assert.equal("senderId" in page.messages[0], false);
  assert.equal("receiverId" in page.messages[0], false);

  const cursor = decodeMessageCursor(page.pageInfo.nextCursor);
  assert.equal(cursor.id, ids[1]);
  assert.equal(cursor.createdAt.toISOString(), "2026-09-28T12:00:00.000Z");
});

test("message list applies the cursor boundary and caps its page size", async () => {
  const seen = {};
  const service = createMessageListService({
    model: createModel([], seen),
    decodeCursor: () => ({ createdAt: new Date("2026-09-28T12:00:00.000Z"), id: ids[1] }),
  });

  const page = await service.getAllMessages({ _id: "user-id" }, { cursor: "ignored", limit: 999 });
  assert.equal(seen.limit, MAX_MESSAGE_PAGE_SIZE + 1);
  assert.deepEqual(seen.filter.$and, [{
    $or: [
      { createdAt: { $lt: new Date("2026-09-28T12:00:00.000Z") } },
      { createdAt: new Date("2026-09-28T12:00:00.000Z"), _id: { $lt: ids[1] } },
    ],
  }]);
  assert.equal(page.pageInfo.nextCursor, null);
});

test("message list query validation limits page sizes and accepts a cursor", () => {
  assert.equal(listMessages.query.validate({ limit: 50, cursor: "cursor-value" }).error, undefined);
  assert.ok(listMessages.query.validate({ limit: 51 }).error);
  assert.throws(() => decodeMessageCursor("not-a-valid-cursor"), /invalid message cursor/);
});
