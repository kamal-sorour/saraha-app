import { badRequestException, notFoundException } from "../../common/utils/response/error.response.js"
import { createOne, deleteOne, find, findOne } from "../../DB/database.repository.js"
import { MessageModel, UserModel } from "../../DB/index.js"
import { toPublicMessage } from "./message.dto.js";

export const MAX_MESSAGE_PAGE_SIZE = 50;
export const DEFAULT_MESSAGE_PAGE_SIZE = 20;

export const encodeMessageCursor = ({ createdAt, _id }) => Buffer.from(JSON.stringify({
  createdAt: new Date(createdAt).toISOString(),
  id: String(_id),
})).toString("base64url");

export const decodeMessageCursor = (cursor) => {
  if (!cursor) return null;
  try {
    const { createdAt, id } = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    const date = new Date(createdAt);
    if (!id || !MessageModel.db.base.Types.ObjectId.isValid(id) || Number.isNaN(date.getTime())) {
      throw new Error("invalid cursor");
    }
    return { createdAt: date, id };
  } catch {
    throw badRequestException({ message: "invalid message cursor" });
  }
};

export const createMessageListService = ({ model = MessageModel, decodeCursor = decodeMessageCursor } = {}) => ({
  async getAllMessages(user, { cursor, limit = DEFAULT_MESSAGE_PAGE_SIZE } = {}) {
    const pageSize = Math.min(Number(limit) || DEFAULT_MESSAGE_PAGE_SIZE, MAX_MESSAGE_PAGE_SIZE);
    const filter = { $or: [{ senderId: user._id }, { receiverId: user._id }] };
    const position = decodeCursor(cursor);
    if (position) {
      filter.$and = [{
        $or: [
          { createdAt: { $lt: position.createdAt } },
          { createdAt: position.createdAt, _id: { $lt: position.id } },
        ],
      }];
    }

    const rows = await model.find(filter)
      .sort({ createdAt: -1, _id: -1 })
      .limit(pageSize + 1)
      .lean()
      .exec();
    const hasMore = rows.length > pageSize;
    const messages = rows.slice(0, pageSize);
    const lastMessage = messages.at(-1);

    return {
      messages: messages.map(toPublicMessage),
      pageInfo: {
        limit: pageSize,
        hasMore,
        nextCursor: hasMore && lastMessage ? encodeMessageCursor(lastMessage) : null,
      },
    };
  },
});

export const getAllMessages = createMessageListService().getAllMessages;
export const sendMessage = async (receiverId, files = [], { content }, user) => {
  const receiver = await findOne({
    model: UserModel,
    filter: {
      _id: receiverId,
      confirmEmail: { $exists: true }
    }
  })
  if (!receiver) {
    throw notFoundException({ message: "No matching account" })
  }
  const message = await createOne({
    model: MessageModel,
    data: {
      content,
      attachments: files.map(file => file.finalPath) || [],
      receiverId,
      senderId: user ? user._id : undefined
    }
  })
  return toPublicMessage(message)
}
export const getMessageById = async (messageId, user) => {
  const message = await findOne({
    model: MessageModel, filter: {
      _id: messageId,
      $or: [
        { senderId: user._id },
        { receiverId: user._id },

      ],
    },
  })
  if (!message) {
    throw notFoundException({ message: "invalid messageId or not autherized action" })
  }
  return toPublicMessage(message)
}
export const deleteMessageById = async (messageId, user) => {
  const message = await deleteOne({
    model: MessageModel, filter: {
      _id: messageId,
      receiverId: user._id,
    }
  })
  if (!message.deletedCount) {
    throw notFoundException({ message: "invalid messageId or not autherized action" })
  }
  return message
}
