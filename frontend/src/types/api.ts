// Mirrors the real backend contract (see BACKEND_AUDIT.md, sections 2 and 9).

/** Values the backend accepts in the `agent` form field. */
export type BackendAgent =
  | "auto"
  | "chat"
  | "search"
  | "coding"
  | "pdf"
  | "ppt"
  | "vision"
  | "pdfRag"
  | "imageAnalyzer";

export interface User {
  id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

/** Response of GET /api/user */
export interface SessionResponse {
  user: { userId: string; name?: string; email?: string; avatar?: string };
}

/** Response of POST /api/auth/login */
export interface LoginResponse {
  _id: string;
  name?: string;
  email?: string;
  avatar?: string;
}

export interface Conversation {
  _id: string;
  userId: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export type GeneratedFileType = "pdf" | "ppt" | "image";

/** A stored S3 object. URLs are only present when freshly signed and expire. */
export interface StoredFile {
  name: string;
  mimeType?: string;
  size?: number;
  key: string;
  url?: string;
  downloadUrl?: string;
  expiresAt?: string;
}

export interface GeneratedFile extends StoredFile {
  type?: GeneratedFileType;
}

export type Attachment = StoredFile;

export interface Source {
  title: string;
  url: string;
  snippet?: string;
}

export interface ArtifactFile {
  name: string;
  content: string;
  language?: string;
}

export interface Artifact {
  id: number;
  type: string;
  title: string;
  entry?: string;
  files: ArtifactFile[];
}

export type MessageRole = "user" | "assistant";
export type Feedback = "up" | "down";

export interface Message {
  _id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agent?: string;
  images?: string[];
  artifacts?: Artifact[];
  attachments?: Attachment[];
  files?: GeneratedFile[];
  sources?: Source[];
  feedback?: Feedback;
  createdAt: string;
  updatedAt?: string;
}

/** Response of POST /api/agent/chat */
export interface ChatResponse {
  answer: string;
  agent: string;
  images: string[];
  artifacts: Artifact[];
  sources: Source[];
  files: GeneratedFile[];
  attachments: Attachment[];
  userMessage: Message;
  assistantMessage: Message;
}

export interface FileUrlResponse {
  url: string;
  downloadUrl: string;
  expiresAt: string;
}

/** Error body used by every service. */
export interface ApiErrorBody {
  success: false;
  code: string;
  message: string;
  retryAfter?: string;
  remainingTime?: number;
}
