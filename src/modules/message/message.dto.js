export const toPublicMessage = (message) => {
  if (!message) return null;
  const value = typeof message.toObject === "function" ? message.toObject() : message;
  return {
    id: String(value._id ?? value.id),
    content: value.content,
    attachments: value.attachments ?? [],
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
};