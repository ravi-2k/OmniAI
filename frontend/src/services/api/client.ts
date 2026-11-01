import { env, LIMITS } from "@/config/env";
import { ApiError, errorFromResponse } from "./errors";

type UnauthorizedHandler = () => void;
let unauthorizedHandler: UnauthorizedHandler | null = null;

/** Called once for any 401 from an authenticated endpoint (session ended). */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  unauthorizedHandler = handler;
};

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Don't treat a 401 as "session ended" (used for the boot session probe and login). */
  skipUnauthorized?: boolean;
}

export const buildUrl = (path: string, query?: RequestOptions["query"]) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const qs = params.toString();
  return `${env.apiBase}${path}${qs ? `?${qs}` : ""}`;
};

const handleUnauthorized = (status: number, skip?: boolean) => {
  if (status === 401 && !skip) unauthorizedHandler?.();
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, query, signal, timeoutMs = LIMITS.requestTimeoutMs } = options;

  const controller = new AbortController();
  let reason: "timeout" | "aborted" | null = null;

  const onAbort = () => {
    reason = "aborted";
    controller.abort();
  };
  if (signal?.aborted) onAbort();
  else signal?.addEventListener("abort", onAbort, { once: true });

  const timer = setTimeout(() => {
    reason = "timeout";
    controller.abort();
  }, timeoutMs);

  try {
    const response = await fetch(buildUrl(path, query), {
      method,
      credentials: "include",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();

    if (!response.ok) {
      handleUnauthorized(response.status, options.skipUnauthorized);
      throw errorFromResponse(response.status, text);
    }

    return (text ? JSON.parse(text) : undefined) as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (reason === "timeout") throw new ApiError(0, "TIMEOUT", "Request timed out");
    if (reason === "aborted") throw new ApiError(0, "ABORTED", "Request cancelled");
    throw new ApiError(0, "NETWORK_ERROR", "Network error");
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

export interface UploadOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** 0-100 while the request body is being sent. */
  onUploadProgress?: (percent: number) => void;
}

/** multipart POST via XHR (fetch can't report upload progress). */
export function postForm<T>(path: string, form: FormData, options: UploadOptions = {}): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", buildUrl(path));
    xhr.withCredentials = true;
    xhr.timeout = options.timeoutMs ?? LIMITS.chatTimeoutMs;
    xhr.setRequestHeader("Accept", "application/json");

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) {
        options.onUploadProgress?.(Math.round((event.loaded / event.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText) as T);
        } catch {
          reject(new ApiError(xhr.status, "BAD_AI_RESPONSE", "Invalid response"));
        }
        return;
      }
      handleUnauthorized(xhr.status);
      reject(errorFromResponse(xhr.status, xhr.responseText));
    };

    xhr.onerror = () => reject(new ApiError(0, "NETWORK_ERROR", "Network error"));
    xhr.ontimeout = () => reject(new ApiError(0, "TIMEOUT", "Request timed out"));
    xhr.onabort = () => reject(new ApiError(0, "ABORTED", "Request cancelled"));

    if (options.signal) {
      if (options.signal.aborted) {
        xhr.abort();
        return;
      }
      options.signal.addEventListener("abort", () => xhr.abort(), { once: true });
    }

    xhr.send(form);
  });
}
