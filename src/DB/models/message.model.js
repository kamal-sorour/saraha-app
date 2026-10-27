import mongoose from "mongoose"

const messageSchema = new mongoose.Schema({
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  content: {
    type: String,
    minLength: 2,
    maxLength: 10000,
    required: function () {
      return !this.attachments?.length
    }
  },
  attachments: { type: [String] }
}, {
  timestamps: true,
  collection: "SARAHA_MESSAGES",
  strictQuery: true,
  strict: true,
  toObject: { virtuals: true },
  toJSON: { virtuals: true }
})

messageSchema.index({ receiverId: 1, createdAt: -1, _id: -1 });
messageSchema.index({ senderId: 1, createdAt: -1, _id: -1 });

export const MessageModel = mongoose.model.Message || mongoose.model("Message", messageSchema)
