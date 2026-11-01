import { describe, expect, it } from "vitest";
import { Route, Routes } from "react-router-dom";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import ChatPage from "@/pages/ChatPage";
import { renderApp } from "../render";
import { server } from "../server";
import { API, chatResponse, conversation, htmlArtifact, message } from "../fixtures";

const user = () => userEvent.setup({ pointerEventsCheck: 0 });

const backend = (history: ReturnType<typeof message>[] = [], id = "c1") =>
  server.use(
    http.get(`${API}/api/chat/conversation/${id}`, () => HttpResponse.json(conversation({ _id: id }))),
    http.get(`${API}/api/chat/get-messages/${id}`, () => HttpResponse.json(history)),
    http.get(`${API}/api/chat/get-conversation`, () => HttpResponse.json([])),
  );

const renderChat = (route = "/c/c1") =>
  renderApp(
    <Routes>
      <Route index element={<ChatPage />} />
      <Route path="c/:conversationId" element={<ChatPage />} />
    </Routes>,
    { route },
  );

/** Captures the multipart body the app sends so tests can assert on it. */
const captureChat = (respond: () => Response | Promise<Response>) => {
  const bodies: string[] = [];
  server.use(
    http.post(`${API}/api/agent/chat`, async ({ request }) => {
      bodies.push(await request.text());
      return respond();
    }),
  );
  return bodies;
};

const field = (body: string, name: string) =>
  new RegExp(`name="${name}"(?:; filename="[^"]*")?\\r\\n(?:[^\\r\\n]+\\r\\n)*\\r\\n([^\\r\\n]*)`).exec(body)?.[1];

const composer = () => screen.getByRole("textbox", { name: "Message OmniAI" });

describe("conversation history", () => {
  it("loads and shows earlier messages", async () => {
    backend([
      message({ _id: "m1", role: "user", content: "What is Rust?" }),
      message({ _id: "m2", role: "assistant", content: "A systems **language**.", agent: "chat" }),
    ]);
    renderChat();

    expect(await screen.findByText("What is Rust?")).toBeInTheDocument();
    expect(await screen.findByText("language")).toBeInTheDocument();
    expect(screen.getByText("Test chat")).toBeInTheDocument();
  });

  it("shows an empty state with suggestions for a brand-new chat", async () => {
    renderChat("/");
    expect(await screen.findByRole("heading", { name: /What would you like to create today/i })).toBeInTheDocument();

    await user().click(screen.getByRole("button", { name: /Create a PDF report/i }));
    expect((composer() as HTMLTextAreaElement).value).toMatch(/PDF report/i);
    // Picking a suggestion selects the matching agent.
    expect(screen.getByRole("button", { name: /Agent: PDF/i })).toBeInTheDocument();
  });

  it("tells the user when a conversation doesn't exist", async () => {
    server.use(
      http.get(`${API}/api/chat/conversation/gone`, () =>
        HttpResponse.json({ success: false, code: "CONVERSATION_NOT_FOUND", message: "x" }, { status: 404 }),
      ),
      http.get(`${API}/api/chat/get-messages/gone`, () =>
        HttpResponse.json({ success: false, code: "CONVERSATION_NOT_FOUND", message: "x" }, { status: 404 }),
      ),
    );
    renderChat("/c/gone");
    expect(await screen.findByText("This conversation doesn't exist")).toBeInTheDocument();
  });
});

describe("sending messages", () => {
  it("sends with Enter, shows the reply and clears the composer", async () => {
    backend();
    const bodies = captureChat(() =>
      HttpResponse.json(
        chatResponse({
          assistantMessage: message({ _id: "a-1", content: "Hello from the agent", agent: "chat" }),
          userMessage: message({ _id: "u-1", role: "user", content: "hi there" }),
        }),
      ),
    );
    renderChat();
    const u = user();

    await u.type(composer(), "hi there{Enter}");

    expect(await screen.findByText("Hello from the agent")).toBeInTheDocument();
    expect(screen.getByText("hi there")).toBeInTheDocument();
    expect(composer()).toHaveValue("");
    expect(field(bodies[0]!, "prompt")).toBe("hi there");
    expect(field(bodies[0]!, "agent")).toBe("auto");
    expect(field(bodies[0]!, "conversationId")).toBe("c1");
  });

  it("uses Shift+Enter for a newline instead of sending", async () => {
    backend();
    const bodies = captureChat(() => HttpResponse.json(chatResponse()));
    renderChat();
    const u = user();

    await u.type(composer(), "line one{Shift>}{Enter}{/Shift}line two");
    expect(composer()).toHaveValue("line one\nline two");
    expect(bodies).toHaveLength(0);
  });

  it("won't send an empty message", async () => {
    backend();
    renderChat();
    expect(await screen.findByRole("button", { name: "Send message" })).toBeDisabled();
  });

  it("sends the chosen agent", async () => {
    backend();
    const bodies = captureChat(() => HttpResponse.json(chatResponse()));
    renderChat();
    const u = user();

    await u.click(screen.getByRole("button", { name: /Agent: Auto/i }));
    await u.click(await screen.findByRole("menuitemradio", { name: /Search/i }));
    await u.type(composer(), "latest news{Enter}");

    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(field(bodies[0]!, "agent")).toBe("search");
  });

  it("shows which agent answered when Auto chose it", async () => {
    backend();
    captureChat(() =>
      HttpResponse.json(
        chatResponse({ agent: "coding", assistantMessage: message({ _id: "a-1", content: "Done", agent: "coding" }) }),
      ),
    );
    renderChat();
    await user().type(composer(), "write a function{Enter}");

    expect(await screen.findByText("Done")).toBeInTheDocument();
    const reply = screen.getByRole("article", { name: "Assistant response" });
    expect(within(reply).getByText("Coding")).toBeInTheDocument();
  });

  it("creates the conversation on the first send of a new chat", async () => {
    let created = 0;
    server.use(
      http.post(`${API}/api/chat/create-conversation`, () => {
        created++;
        return HttpResponse.json(conversation({ _id: "n1", title: "New Chat" }));
      }),
    );
    backend([], "n1");
    const bodies = captureChat(() =>
      HttpResponse.json(
        chatResponse({
          assistantMessage: message({ _id: "a-1", conversationId: "n1", content: "Welcome!" }),
          userMessage: message({ _id: "u-1", conversationId: "n1", role: "user", content: "hello" }),
        }),
      ),
    );
    renderChat("/");

    await user().type(composer(), "hello{Enter}");

    expect(await screen.findByText("Welcome!")).toBeInTheDocument();
    expect(created).toBe(1);
    expect(field(bodies[0]!, "conversationId")).toBe("n1");
  });

  it("keeps the user's text when the new conversation can't be created", async () => {
    server.use(
      http.post(`${API}/api/chat/create-conversation`, () =>
        HttpResponse.json({ success: false, code: "SERVER_ERROR", message: "x" }, { status: 500 }),
      ),
    );
    renderChat("/");
    await user().type(composer(), "don't lose me{Enter}");

    expect(await screen.findByText("Couldn't start a new chat")).toBeInTheDocument();
    expect(composer()).toHaveValue("don't lose me");
  });
});

describe("failures", () => {
  it("shows an error and recovers with Retry", async () => {
    backend();
    let attempts = 0;
    captureChat(() => {
      attempts++;
      return attempts === 1
        ? HttpResponse.json({ success: false, code: "AGENT_FAILED", message: "internal detail" }, { status: 502 })
        : HttpResponse.json(
            chatResponse({
              userMessage: message({ _id: "u-1", role: "user", content: "try this" }),
              assistantMessage: message({ _id: "a-1", content: "Second time lucky" }),
            }),
          );
    });
    renderChat();
    const u = user();

    await u.type(composer(), "try this{Enter}");

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("The AI couldn't complete that request");
    expect(alert).not.toHaveTextContent("internal detail");

    await u.click(screen.getByRole("button", { name: /Retry/ }));
    expect(await screen.findByText("Second time lucky")).toBeInTheDocument();
    expect(attempts).toBe(2);
    // The user's message is shown once, not duplicated by the retry.
    expect(screen.getAllByText("try this")).toHaveLength(1);
  });

  it("holds Retry back until a rate limit resets", async () => {
    backend();
    captureChat(() =>
      HttpResponse.json(
        {
          success: false,
          code: "RATE_LIMITED",
          message: "You have reached the chat limit (20 requests/minute). Try again in 30s.",
          remainingTime: 30,
        },
        { status: 429 },
      ),
    );
    renderChat();
    await user().type(composer(), "again{Enter}");

    expect(await screen.findByText(/reached the chat limit/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Retry in \d+s/ })).toBeDisabled();
  });

  it("shows network failures without crashing", async () => {
    backend();
    server.use(http.post(`${API}/api/agent/chat`, () => HttpResponse.error()));
    renderChat();
    await user().type(composer(), "hello{Enter}");
    expect(await screen.findByText(/Can't reach the server/)).toBeInTheDocument();
  });
});

describe("attachments", () => {
  const pdf = () => new File(["%PDF-1.4"], "report.pdf", { type: "application/pdf" });
  const fileInput = () => document.querySelector<HTMLInputElement>('input[type="file"]')!;

  it("attaches a PDF, sends it, and can be removed first", async () => {
    backend();
    const bodies = captureChat(() => HttpResponse.json(chatResponse()));
    renderChat();
    const u = user();

    await u.upload(fileInput(), pdf());
    expect(screen.getByText("report.pdf")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: "Remove report.pdf" }));
    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();

    await u.upload(fileInput(), pdf());
    await u.type(composer(), "summarise{Enter}");
    await waitFor(() => expect(bodies).toHaveLength(1));
    expect(bodies[0]).toMatch(/name="file"; filename="report.pdf"/);
  });

  it("rejects an unsupported file type", async () => {
    backend();
    renderChat();
    const input = fileInput();
    // The browser's accept filter is bypassed here to test our own validation.
    await userEvent.setup({ applyAccept: false, pointerEventsCheck: 0 }).upload(
      input,
      new File(["hi"], "notes.txt", { type: "text/plain" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(/Only PDFs and images/);
    expect(screen.queryByText("notes.txt")).not.toBeInTheDocument();
  });

  it("disables attachments for agents that don't use them", async () => {
    backend();
    renderChat();
    const u = user();
    await u.click(screen.getByRole("button", { name: /Agent: Auto/i }));
    await u.click(await screen.findByRole("menuitemradio", { name: /Coding/i }));
    expect(screen.getByRole("button", { name: /Coding doesn't use attachments/i })).toBeDisabled();
  });

  it("drops an attachment when switching to an agent that can't use it", async () => {
    backend();
    renderChat();
    const u = user();
    await u.upload(fileInput(), pdf());
    expect(screen.getByText("report.pdf")).toBeInTheDocument();

    await u.click(screen.getByRole("button", { name: /Agent: Auto/i }));
    await u.click(await screen.findByRole("menuitemradio", { name: /Chat/i }));

    expect(screen.queryByText("report.pdf")).not.toBeInTheDocument();
    expect(await screen.findByText("Attachment removed")).toBeInTheDocument();
  });
});

describe("generated code", () => {
  it("opens the artifacts panel for a live response that contains a project", async () => {
    backend();
    captureChat(() =>
      HttpResponse.json(
        chatResponse({
          agent: "coding",
          answer: "Code Generated Successfully.",
          artifacts: [htmlArtifact()],
          assistantMessage: message({ _id: "a-1", content: "Code Generated Successfully.", agent: "coding", artifacts: [htmlArtifact()] }),
        }),
      ),
    );
    renderChat();
    await user().type(composer(), "build a landing page{Enter}");

    const frame = await screen.findByTitle(/Preview of Landing page/);
    // Generated code must be sandboxed: scripts allowed, but never same-origin.
    expect(frame).toHaveAttribute("sandbox", "allow-scripts");
    expect(frame.getAttribute("srcdoc")).toContain("Content-Security-Policy");
  });

  it("does not auto-open the panel when loading history, only offers it", async () => {
    backend([
      message({ _id: "m1", role: "user", content: "build it" }),
      message({ _id: "m2", content: "Code Generated Successfully.", agent: "coding", artifacts: [htmlArtifact()] }),
    ]);
    renderChat();

    const card = await screen.findByRole("button", { name: /Landing page/ });
    expect(screen.queryByTitle(/Preview of/)).not.toBeInTheDocument();

    await user().click(card);
    expect(await screen.findByTitle(/Preview of Landing page/)).toBeInTheDocument();
  });

  it("does not open the panel for a coding reply without files", async () => {
    backend();
    captureChat(() =>
      HttpResponse.json(
        chatResponse({
          agent: "coding",
          artifacts: [],
          assistantMessage: message({ _id: "a-1", content: "Here is an explanation.", agent: "coding" }),
        }),
      ),
    );
    renderChat();
    await user().type(composer(), "explain closures{Enter}");

    expect(await screen.findByText("Here is an explanation.")).toBeInTheDocument();
    expect(screen.queryByTitle(/Preview of/)).not.toBeInTheDocument();
  });
});
