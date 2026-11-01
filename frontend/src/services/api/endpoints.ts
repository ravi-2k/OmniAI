import type {
  BackendAgent,
  ChatResponse,
  Conversation,
  Feedback,
  FileUrlResponse,
  LoginResponse,
  Message,
  SessionResponse,
  User,
} from "@/types/api";
import { LIMITS } from "@/config/env";
import { postForm, request, type UploadOptions } from "./client";

// ---- auth ----
export const toUser = (raw: {
  _id?: string;
  userId?: string;
  name?: string;
  email?: string;
  avatar?: string;
}): User => ({
  id: raw.userId ?? raw._id ?? "",
  name: raw.name,
  email: raw.email,
  avatar: raw.avatar,
});

export const authApi = {
  /** Boot probe: 401 here just means "not signed in", not "session ended". */
  async getSession(signal?: AbortSignal): Promise<User> {
    const data = await request<SessionResponse>("/api/user", { signal, skipUnauthorized: true });
    return toUser(data.user);
  },
  async login(token: string): Promise<User> {
    const data = await request<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: { token },
      skipUnauthorized: true,
    });
    return toUser(data);
  },
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
};

// ---- conversations ----
export const conversationsApi = {
  list: (params: { limit?: number; before?: string; q?: string }, signal?: AbortSignal) =>
    request<Conversation[]>("/api/chat/get-conversation", { query: params, signal }),
  get: (id: string, signal?: AbortSignal) =>
    request<Conversation>(`/api/chat/conversation/${id}`, { signal }),
  create: () => request<Conversation>("/api/chat/create-conversation", { method: "POST" }),
  rename: (id: string, title: string) =>
    request<Conversation>("/api/chat/update-conversation", {
      method: "POST",
      body: { id, title },
    }),
  remove: (id: string) =>
    request<{ message: string }>(`/api/chat/delete-conversation/${id}`, { method: "DELETE" }),
};

// ---- messages ----
export const messagesApi = {
  /** Oldest -> newest. Without `before`, returns the latest page. */
  list: (id: string, params: { limit?: number; before?: string }, signal?: AbortSignal) =>
    request<Message[]>(`/api/chat/get-messages/${id}`, { query: params, signal }),
  feedback: (messageId: string, value: Feedback | null) =>
    request<{ messageId: string; feedback: Feedback | null }>("/api/chat/feedback", {
      method: "POST",
      body: { messageId, value },
    }),
};

// ---- agent ----
export interface ChatInput {
  prompt: string;
  conversationId: string;
  agent: BackendAgent;
  file?: File;
}

export const agentApi = {
  chat(input: ChatInput, options: UploadOptions = {}) {
    const form = new FormData();
    form.set("prompt", input.prompt);
    form.set("conversationId", input.conversationId);
    form.set("agent", input.agent);
    if (input.file) form.set("file", input.file);
    return postForm<ChatResponse>("/api/agent/chat", form, {
      timeoutMs: LIMITS.chatTimeoutMs,
      ...options,
    });
  },
  fileUrl: (key: string, name?: string, signal?: AbortSignal) =>
    request<FileUrlResponse>("/api/agent/file-url", { query: { key, name }, signal }),
};
