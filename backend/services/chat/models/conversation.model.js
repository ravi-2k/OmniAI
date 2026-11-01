import mongoose from "mongoose";

export const DEFAULT_TITLE = "New Chat";

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: String,
      required: true,
      index: true,
    },
    title: {
      type: String,
      default: DEFAULT_TITLE,
      maxlength: 120,
    },
    messageCount: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true },
);

conversationSchema.index({ userId: 1, updatedAt: -1 });

const conversationModel = mongoose.model("Conversation", conversationSchema);

export default conversationModel;
