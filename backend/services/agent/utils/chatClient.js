import axios from "axios";

import { internalHeaders } from "../../../shared/http/internal.js";

// Thin client for the chat service. Every call is made on behalf of a user so
// the chat service can enforce conversation ownership.
const request = (userId) =>
  axios.create({
    baseURL: process.env.CHAT_SERVICE,
    timeout: 15000,
    headers: internalHeaders(userId),
  });

export const getConversation = async (userId, conversationId) => {
  const { data } = await request(userId).get(`/conversation/${conversationId}`);
  return data;
};

// Oldest -> newest, at most `limit` latest messages.
export const getMessages = async (userId, conversationId, limit = 20) => {
  const { data } = await request(userId).get(`/get-messages/${conversationId}`, {
    params: { limit },
  });
  return data;
};

export const saveMessages = async (userId, conversationId, messages) => {
  const { data } = await request(userId).post("/save-messages", {
    conversationId,
    messages,
  });
  return data;
};
