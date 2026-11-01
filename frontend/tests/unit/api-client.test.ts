import { afterEach, describe, expect, it, vi } from "vitest";
import { http, HttpResponse, delay } from "msw";

import { postForm, request, setUnauthorizedHandler } from "@/services/api/client";
import type { ApiError } from "@/services/api/errors";
import { agentApi, authApi, conversationsApi } from "@/services/api/endpoints";
import { server } from "../server";
import { API } from "../fixtures";

afterEach(() => setUnauthorizedHandler(null));

const caught = async (promise: Promise<unknown>) => {
  try {
    await promise;
  } catch (error) {
    return error as ApiError;
  }
  throw new Error("expected the request to fail");
};

describe("api client", () => {
  it("sends cookies and parses JSON", async () => {
    server.use(
      http.get(`${API}/api/user`, () =>
        HttpResponse.json({ user: { userId: "u1", name: "Ada", email: "ada@x.com" } }),
      ),
    );
    const spy = vi.spyOn(globalThis, "fetch");
    const user = await authApi.getSession();
    expect(user).toEqual({ id: "u1", name: "Ada", email: "ada@x.com", avatar: undefined });
    expect(spy.mock.calls[0]?.[1]).toMatchObject({ credentials: "include" });
    spy.mockRestore();
  });

  it("turns a 401 into 'session ended' exactly once", async () => {
    const onEnded = vi.fn();
    setUnauthorizedHandler(onEnded);
    server.use(
      http.get(`${API}/api/chat/get-conversation`, () =>
        HttpResponse.json({ success: false, code: "SESSION_EXPIRED", message: "Session expired" }, { status: 401 }),
      ),
    );
    const error = await caught(conversationsApi.list({}));
    expect(error.code).toBe("SESSION_EXPIRED");
    expect(onEnded).toHaveBeenCalledTimes(1);
  });

  it("does not treat the boot probe's 401 as an expired session", async () => {
    const onEnded = vi.fn();
    setUnauthorizedHandler(onEnded);
    server.use(
      http.get(`${API}/api/user`, () =>
        HttpResponse.json({ success: false, code: "UNAUTHORIZED", message: "Unauthorized" }, { status: 401 }),
      ),
    );
    await caught(authApi.getSession());
    expect(onEnded).not.toHaveBeenCalled();
  });

  it("maps network failures", async () => {
    server.use(http.get(`${API}/api/user`, () => HttpResponse.error()));
    expect((await caught(authApi.getSession())).code).toBe("NETWORK_ERROR");
  });

  it("times out", async () => {
    server.use(
      http.get(`${API}/slow`, async () => {
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    expect((await caught(request("/slow", { timeoutMs: 50 }))).code).toBe("TIMEOUT");
  });

  it("supports cancellation", async () => {
    server.use(
      http.get(`${API}/slow`, async () => {
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    const pending = caught(request("/slow", { signal: controller.signal }));
    controller.abort();
    expect((await pending).code).toBe("ABORTED");
  });
});

describe("chat upload", () => {
  it("posts the multipart fields the backend expects, including the file", async () => {
    let body = "";
    server.use(
      http.post(`${API}/api/agent/chat`, async ({ request: req }) => {
        body = await req.text();
        return HttpResponse.json({ answer: "ok" });
      }),
    );
    await agentApi.chat(
      {
        prompt: "hello",
        conversationId: "c1",
        agent: "pdfRag",
        file: new File(["%PDF"], "doc.pdf", { type: "application/pdf" }),
      },
      { onUploadProgress: vi.fn() },
    );
    expect(body).toMatch(/name="prompt"\r\n\r\nhello/);
    expect(body).toMatch(/name="conversationId"\r\n\r\nc1/);
    expect(body).toMatch(/name="agent"\r\n\r\npdfRag/);
    expect(body).toMatch(/name="file"; filename="doc.pdf"/);
  });

  it("surfaces rate limits with their reset time", async () => {
    server.use(
      http.post(`${API}/api/agent/chat`, () =>
        HttpResponse.json(
          { success: false, code: "RATE_LIMITED", message: "Limit reached", remainingTime: 30, retryAfter: "30s" },
          { status: 429 },
        ),
      ),
    );
    const error = await caught(agentApi.chat({ prompt: "x", conversationId: "c1", agent: "chat" }));
    expect([error.status, error.code, error.remainingTime]).toEqual([429, "RATE_LIMITED", 30]);
  });

  it("can be cancelled mid-flight", async () => {
    server.use(
      http.post(`${API}/api/agent/chat`, async () => {
        await delay(500);
        return HttpResponse.json({});
      }),
    );
    const controller = new AbortController();
    const pending = caught(postForm("/api/agent/chat", new FormData(), { signal: controller.signal }));
    setTimeout(() => controller.abort(), 20);
    expect((await pending).code).toBe("ABORTED");
  });
});
