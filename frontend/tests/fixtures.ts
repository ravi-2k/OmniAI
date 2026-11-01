import type { Artifact, ChatResponse, Conversation, Message } from "@/types/api";

export const API = "http://api.test";

export const conversation = (overrides: Partial<Conversation> = {}): Conversation => ({
  _id: "c1",
  userId: "u1",
  title: "Test chat",
  messageCount: 0,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
});

export const message = (overrides: Partial<Message> = {}): Message => ({
  _id: "m1",
  conversationId: "c1",
  role: "assistant",
  content: "Hello there",
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const htmlArtifact = (): Artifact => ({
  id: 1,
  type: "Project",
  title: "Landing page",
  entry: "index.html",
  files: [
    {
      name: "index.html",
      language: "html",
      content:
        '<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><h1>Hi</h1><script src="script.js"></script></body></html>',
    },
    { name: "style.css", language: "css", content: "h1{color:red}" },
    { name: "script.js", language: "javascript", content: "console.log('hi')" },
  ],
});

export const chatResponse = (overrides: Partial<ChatResponse> = {}): ChatResponse => ({
  answer: "Sure thing",
  agent: "chat",
  images: [],
  artifacts: [],
  sources: [],
  files: [],
  attachments: [],
  userMessage: message({ _id: "u-1", role: "user", content: "hi" }),
  assistantMessage: message({ _id: "a-1", role: "assistant", content: "Sure thing", agent: "chat" }),
  ...overrides,
});
