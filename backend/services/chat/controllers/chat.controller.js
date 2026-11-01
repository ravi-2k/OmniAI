import Conversation, { DEFAULT_TITLE } from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import { HttpError } from "../../../shared/http/errors.js";

const OBJECT_ID = /^[a-f\d]{24}$/i;
const TITLE_MAX = 120;
const AUTO_TITLE_MAX = 60;
const MAX_MESSAGES_PER_SAVE = 10;
const MAX_ARRAY = 50;

const assertObjectId = (value, label = "id") => {
  if (typeof value !== "string" || !OBJECT_ID.test(value)) {
    throw new HttpError(400, "INVALID_ID", `Invalid ${label}`);
  }
  return value;
};

const parseLimit = (value, fallback, max) => {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A conversation the caller does not own is reported as missing so ids can't
// be probed.
const getOwnedConversation = async (conversationId, userId) => {
  assertObjectId(conversationId, "conversation id");
  const conversation = await Conversation.findOne({
    _id: conversationId,
    userId,
  });

  if (!conversation) {
    throw new HttpError(
      404,
      "CONVERSATION_NOT_FOUND",
      "Conversation not found",
    );
  }
  return conversation;
};

const asString = (value) => (typeof value === "string" ? value : undefined);

const asArray = (value) =>
  Array.isArray(value) ? value.slice(0, MAX_ARRAY) : [];

const cleanMessage = (input) => {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "INVALID_REQUEST", "Invalid message");
  }

  if (!["user", "assistant"].includes(input.role)) {
    throw new HttpError(400, "INVALID_REQUEST", "Invalid message role");
  }

  if (input.content !== undefined && typeof input.content !== "string") {
    throw new HttpError(400, "INVALID_REQUEST", "Message content must be text");
  }

  return {
    role: input.role,
    content: input.content ?? "",
    agent: asString(input.agent),
    images: asArray(input.images).filter((url) => typeof url === "string"),
    artifacts: asArray(input.artifacts).map((artifact) => ({
      id: Number.isFinite(artifact?.id) ? artifact.id : undefined,
      type: asString(artifact?.type),
      title: asString(artifact?.title),
      entry: asString(artifact?.entry),
      files: asArray(artifact?.files).map((file) => ({
        name: asString(file?.name),
        content: asString(file?.content),
        language: asString(file?.language),
      })),
    })),
    attachments: asArray(input.attachments).map((file) => ({
      name: asString(file?.name),
      mimeType: asString(file?.mimeType),
      size: Number.isFinite(file?.size) ? file.size : undefined,
      key: asString(file?.key),
    })),
    files: asArray(input.files).map((file) => ({
      name: asString(file?.name),
      type: file?.type,
      mimeType: asString(file?.mimeType),
      size: Number.isFinite(file?.size) ? file.size : undefined,
      key: asString(file?.key),
    })),
    sources: asArray(input.sources).map((source) => ({
      title: asString(source?.title),
      url: asString(source?.url),
      snippet: asString(source?.snippet),
    })),
  };
};

const deriveTitle = (content) => {
  const text = (content || "").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > AUTO_TITLE_MAX
    ? `${text.slice(0, AUTO_TITLE_MAX - 1).trimEnd()}…`
    : text;
};

// Persists messages in order. createdAt is spaced by 1ms so ordering is
// deterministic even when several messages are saved in one request.
const persistMessages = async (conversation, rawMessages) => {
  if (!Array.isArray(rawMessages) || !rawMessages.length) {
    throw new HttpError(400, "INVALID_REQUEST", "No messages provided");
  }
  if (rawMessages.length > MAX_MESSAGES_PER_SAVE) {
    throw new HttpError(400, "INVALID_REQUEST", "Too many messages");
  }

  const cleaned = rawMessages.map(cleanMessage);

  // First user message names the conversation (once, only if still untitled).
  const firstUser = cleaned.find((message) => message.role === "user");
  const title = firstUser ? deriveTitle(firstUser.content) : null;
  if (title && conversation.messageCount === 0) {
    await Conversation.updateOne(
      { _id: conversation._id, title: DEFAULT_TITLE, messageCount: 0 },
      { $set: { title } },
    );
  }

  const base = Date.now();
  const saved = [];
  for (const [index, message] of cleaned.entries()) {
    saved.push(
      await Message.create({
        ...message,
        conversationId: conversation._id,
        createdAt: new Date(base + index),
      }),
    );
  }

  await Conversation.updateOne(
    { _id: conversation._id },
    { $inc: { messageCount: saved.length } },
  );

  return saved;
};

export const createConversation = async (req, res) => {
  const conversation = await Conversation.create({ userId: req.userId });
  return res.status(200).json(conversation);
};

export const getConversations = async (req, res) => {
  const limit = parseLimit(req.query.limit, 50, 100);
  const filter = { userId: req.userId };

  if (typeof req.query.before === "string" && req.query.before) {
    const before = new Date(req.query.before);
    if (Number.isNaN(before.getTime())) {
      throw new HttpError(400, "INVALID_REQUEST", "Invalid 'before' value");
    }
    filter.updatedAt = { $lt: before };
  }

  if (typeof req.query.q === "string" && req.query.q.trim()) {
    filter.title = {
      $regex: escapeRegex(req.query.q.trim().slice(0, 100)),
      $options: "i",
    };
  }

  const conversations = await Conversation.find(filter)
    .sort({ updatedAt: -1 })
    .limit(limit);

  return res.status(200).json(conversations);
};

export const getConversation = async (req, res) => {
  const conversation = await getOwnedConversation(
    req.params.conversationId,
    req.userId,
  );
  return res.status(200).json(conversation);
};

export const updateConversation = async (req, res) => {
  const { id, title } = req.body ?? {};

  if (typeof title !== "string" || !title.trim()) {
    throw new HttpError(400, "INVALID_REQUEST", "Title is required");
  }

  const conversation = await getOwnedConversation(id, req.userId);
  conversation.title = title.trim().slice(0, TITLE_MAX);
  await conversation.save();

  return res.status(200).json(conversation);
};

export const deleteConversation = async (req, res) => {
  const conversation = await getOwnedConversation(
    req.params.conversationId,
    req.userId,
  );

  await Message.deleteMany({ conversationId: conversation._id });
  await Conversation.deleteOne({ _id: conversation._id });

  return res.status(200).json({ message: "Conversation deleted" });
};

// Internal: called by the agent service. Blocked at the gateway.
export const saveMessage = async (req, res) => {
  const conversation = await getOwnedConversation(
    req.body?.conversationId,
    req.userId,
  );
  const [message] = await persistMessages(conversation, [req.body]);
  return res.status(200).json(message);
};

// Internal: saves a user/assistant exchange atomically in order.
export const saveMessages = async (req, res) => {
  const conversation = await getOwnedConversation(
    req.body?.conversationId,
    req.userId,
  );
  const messages = await persistMessages(conversation, req.body?.messages);
  return res.status(200).json(messages);
};

// Oldest -> newest. Without `before` returns the latest page; pass the id of
// the oldest loaded message as `before` to page backwards.
export const getMessages = async (req, res) => {
  const conversation = await getOwnedConversation(
    req.params.conversationId,
    req.userId,
  );
  const limit = parseLimit(req.query.limit, 100, 200);
  const filter = { conversationId: conversation._id };

  if (typeof req.query.before === "string" && req.query.before) {
    assertObjectId(req.query.before, "message id");
    const reference = await Message.findOne({
      _id: req.query.before,
      conversationId: conversation._id,
    }).select("createdAt");

    if (reference) {
      filter.$or = [
        { createdAt: { $lt: reference.createdAt } },
        { createdAt: reference.createdAt, _id: { $lt: reference._id } },
      ];
    }
  }

  const messages = await Message.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit)
    .lean();

  return res.status(200).json(messages.reverse());
};

export const setFeedback = async (req, res) => {
  const { messageId, value } = req.body ?? {};
  assertObjectId(messageId, "message id");

  if (value !== null && !["up", "down"].includes(value)) {
    throw new HttpError(400, "INVALID_REQUEST", "Feedback must be up, down or null");
  }

  const message = await Message.findById(messageId);
  if (!message || message.role !== "assistant") {
    throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found");
  }

  await getOwnedConversation(String(message.conversationId), req.userId);

  message.feedback = value ?? undefined;
  await message.save();

  return res.status(200).json({ messageId, feedback: value });
};
