import type { ApiErrorBody } from "@/types/api";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfter?: string;
  /** Seconds until a rate limit resets, when the backend provides it. */
  readonly remainingTime?: number;

  constructor(status: number, code: string, message: string, extra?: Partial<ApiErrorBody>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.retryAfter = extra?.retryAfter;
    this.remainingTime = extra?.remainingTime;
  }
}

export const isApiError = (error: unknown): error is ApiError => error instanceof ApiError;

/** Builds an ApiError from an HTTP status and (possibly unparsable) body text. */
export const errorFromResponse = (status: number, bodyText: string): ApiError => {
  let body: Partial<ApiErrorBody> | undefined;
  try {
    body = JSON.parse(bodyText) as Partial<ApiErrorBody>;
  } catch {
    body = undefined;
  }

  if (body && typeof body.code === "string") {
    return new ApiError(status, body.code, body.message ?? "Request failed", body);
  }

  const fallback =
    status === 401
      ? "UNAUTHORIZED"
      : status === 413
        ? "FILE_TOO_LARGE"
        : status === 429
          ? "RATE_LIMITED"
          : status >= 500
            ? "SERVER_ERROR"
            : "REQUEST_FAILED";
  return new ApiError(status, fallback, "Request failed");
};

// Backend messages are written for end users for these codes; everything else
// gets friendly copy here so internals never leak into the UI.
const USER_MESSAGES: Record<string, string> = {
  UNAUTHORIZED: "Your session has ended. Please sign in again.",
  SESSION_EXPIRED: "Your session has ended. Please sign in again.",
  INVALID_TOKEN: "Sign-in failed. Please try again.",
  NETWORK_ERROR: "Can't reach the server. Check your connection and try again.",
  TIMEOUT: "This is taking longer than expected. Please try again.",
  GATEWAY_TIMEOUT: "This is taking longer than expected. Please try again.",
  SERVICE_UNAVAILABLE: "The service is temporarily unavailable. Please try again shortly.",
  UPSTREAM_ERROR: "The service is temporarily unavailable. Please try again shortly.",
  SERVER_ERROR: "Something went wrong on our side. Please try again.",
  INTERNAL_ERROR: "Something went wrong on our side. Please try again.",
  AGENT_FAILED: "The AI couldn't complete that request. Please try again.",
  BAD_AI_RESPONSE: "The AI returned an unreadable response. Please try again.",
  SEARCH_FAILED: "Web search failed. Please try again.",
  IMAGE_GENERATION_FAILED: "Image generation failed. Please try again.",
  EMPTY_RESPONSE: "The AI returned an empty response. Please try again.",
  FILE_TOO_LARGE: "That file is too large. The limit is 20 MB.",
  UNSUPPORTED_FILE_TYPE: "Only PDFs and images (JPEG, PNG, WebP, GIF, HEIC) are supported.",
  CONVERSATION_NOT_FOUND: "That conversation no longer exists.",
  PROMPT_TOO_LONG: "That message is too long. Please shorten it.",
};

// These carry a specific, user-safe explanation from the backend.
const TRUST_SERVER_MESSAGE = new Set([
  "RATE_LIMITED",
  "NO_PDF",
  "EMPTY_PDF",
  "FILE_MISMATCH",
  "FILE_REQUIRED",
]);

export const userMessage = (error: unknown): string => {
  if (isApiError(error)) {
    if (TRUST_SERVER_MESSAGE.has(error.code) && error.message) return error.message;
    return USER_MESSAGES[error.code] ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
};
