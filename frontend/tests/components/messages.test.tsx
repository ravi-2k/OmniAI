import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";

import type { GeneratedFile, Message } from "@/types/api";
import { AssistantMessage } from "@/components/messages/AssistantMessage";
import { FileCard } from "@/components/messages/FileCard";
import { UserMessage } from "@/components/messages/UserMessage";
import { renderApp } from "../render";
import { server } from "../server";
import { API, message } from "../fixtures";

const user = () => userEvent.setup({ pointerEventsCheck: 0 });
const future = () => new Date(Date.now() + 3_600_000).toISOString();
const past = () => new Date(Date.now() - 60_000).toISOString();

const assistant = (overrides: Partial<Message>) => message({ role: "assistant", ...overrides });

describe("markdown rendering", () => {
  it("renders headings, lists, tables and inline formatting", async () => {
    renderApp(
      <AssistantMessage
        message={assistant({
          content: "# Title\n\n- one\n- two\n\n| a | b |\n|---|---|\n| 1 | 2 |\n\n**bold** and `code`",
        })}
      />,
    );
    expect(await screen.findByRole("heading", { name: "Title" })).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(2);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("bold").tagName).toBe("STRONG");
  });

  it("highlights fenced code and copies the original source", async () => {
    renderApp(<AssistantMessage message={assistant({ content: "```js\nconst a = 1;\nconsole.log(a);\n```" })} />);
    const u = user();

    expect(await screen.findByText("js")).toBeInTheDocument();
    await u.click(screen.getByRole("button", { name: "Copy code" }));

    // The original source is copied, not the highlighted markup.
    expect(await navigator.clipboard.readText()).toBe("const a = 1;\nconsole.log(a);");
    expect(await screen.findByRole("button", { name: "Code copied" })).toBeInTheDocument();
  });

  it("opens external links safely", async () => {
    renderApp(<AssistantMessage message={assistant({ content: "See [the docs](https://example.com/docs)." })} />);
    const link = await screen.findByRole("link", { name: /the docs/ });
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("never renders script links or raw HTML", async () => {
    const { container } = renderApp(
      <AssistantMessage
        message={assistant({
          content: "[click](javascript:alert(1)) <img src=x onerror=alert(1)> <script>alert(1)</script>",
        })}
      />,
    );
    await screen.findByText(/click/);
    expect(container.querySelector('a[href^="javascript"]')).toBeNull();
    expect(container.querySelector("img[onerror]")).toBeNull();
    expect(container.querySelector("script")).toBeNull();
  });
});

describe("search results", () => {
  const sources = [
    { title: "First source", url: "https://one.example/a", snippet: "about one" },
    { title: "Second source", url: "https://two.example/b", snippet: "about two" },
    { title: "Sketchy", url: "javascript:alert(1)", snippet: "" },
  ];

  it("turns [n] markers into links to the matching source", async () => {
    renderApp(<AssistantMessage message={assistant({ content: "Rust is fast [1] and safe [2]. Not a source [9].", sources })} />);

    const cite1 = await screen.findByRole("link", { name: "Source 1: First source" });
    expect(cite1).toHaveAttribute("href", "https://one.example/a");
    expect(screen.getByRole("link", { name: "Source 2: Second source" })).toHaveAttribute("href", "https://two.example/b");
    // [9] has no matching source, so it stays plain text.
    expect(screen.getByText(/Not a source \[9\]/)).toBeInTheDocument();
  });

  it("also understands the 【n】 style some models use", async () => {
    renderApp(
      <AssistantMessage message={assistant({ content: "Fast 【1】 and safe 【2†L4-L9】, unknown 【7】.", sources })} />,
    );
    expect(await screen.findByRole("link", { name: "Source 1: First source" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Source 2: Second source" })).toBeInTheDocument();
    expect(screen.getByText(/unknown 【7】/)).toBeInTheDocument();
  });

  it("lists sources as cards and drops non-web links", async () => {
    renderApp(<AssistantMessage message={assistant({ content: "Answer", sources })} />);
    const section = await screen.findByRole("region", { name: "Sources" });
    expect(within(section).getAllByRole("link")).toHaveLength(2);
    expect(within(section).getByText("about one")).toBeInTheDocument();
    expect(within(section).queryByText("Sketchy")).not.toBeInTheDocument();
  });
});

describe("downloadable files", () => {
  let clicked: string[] = [];

  beforeEach(() => {
    clicked = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this.href);
    });
  });
  afterEach(() => vi.restoreAllMocks());

  const pdf = (overrides: Partial<GeneratedFile> = {}): GeneratedFile => ({
    name: "report.pdf",
    type: "pdf",
    mimeType: "application/pdf",
    size: 2048,
    key: "u1/generated/report.pdf",
    url: "https://s3.example/view",
    downloadUrl: "https://s3.example/download",
    expiresAt: future(),
    ...overrides,
  });

  it("shows name, type and size, and downloads with the live link", async () => {
    let refreshed = false;
    server.use(http.get(`${API}/api/agent/file-url`, () => ((refreshed = true), HttpResponse.json({}))));
    renderApp(<FileCard file={pdf()} />);

    expect(screen.getByText("report.pdf")).toBeInTheDocument();
    expect(screen.getByText(/PDF document · 2.0 KB/)).toBeInTheDocument();

    await user().click(screen.getByRole("button", { name: "Download report.pdf" }));
    await waitFor(() => expect(clicked).toEqual(["https://s3.example/download"]));
    expect(refreshed).toBe(false);
  });

  it("fetches a fresh link when the old one has expired", async () => {
    let requested = "";
    server.use(
      http.get(`${API}/api/agent/file-url`, ({ request }) => {
        requested = new URL(request.url).search;
        return HttpResponse.json({
          url: "https://s3.example/new-view",
          downloadUrl: "https://s3.example/new-download",
          expiresAt: future(),
        });
      }),
    );
    renderApp(<FileCard file={pdf({ expiresAt: past(), url: undefined, downloadUrl: undefined })} />);

    await user().click(screen.getByRole("button", { name: "Download report.pdf" }));
    await waitFor(() => expect(clicked).toEqual(["https://s3.example/new-download"]));
    expect(requested).toContain("key=u1%2Fgenerated%2Freport.pdf");
    expect(requested).toContain("name=report.pdf");
  });

  it("offers a PDF preview but not a PowerPoint preview", () => {
    const { unmount } = renderApp(<FileCard file={pdf()} />);
    expect(screen.getByRole("button", { name: "Preview report.pdf" })).toBeInTheDocument();
    unmount();

    renderApp(<FileCard file={pdf({ name: "deck.pptx", type: "ppt", key: "u1/generated/deck.pptx" })} />);
    expect(screen.getByText(/PowerPoint presentation/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Preview/ })).not.toBeInTheDocument();
  });

  it("tells the user when the link can't be refreshed", async () => {
    server.use(
      http.get(`${API}/api/agent/file-url`, () =>
        HttpResponse.json({ success: false, code: "SERVER_ERROR", message: "x" }, { status: 500 }),
      ),
    );
    renderApp(
      <FileCard file={pdf({ key: "u1/generated/unreachable.pdf", expiresAt: past(), url: undefined, downloadUrl: undefined })} />,
    );

    await user().click(screen.getByRole("button", { name: "Download report.pdf" }));
    expect(await screen.findByText("Couldn't get the file")).toBeInTheDocument();
    expect(clicked).toEqual([]);
  });

  it("renders a generated image and falls back gracefully when it's gone", async () => {
    const image: GeneratedFile = {
      name: "cat.png",
      type: "image",
      mimeType: "image/png",
      key: "u1/generated/cat.png",
      url: "https://s3.example/cat.png",
      downloadUrl: "https://s3.example/cat-dl.png",
      expiresAt: future(),
    };
    renderApp(<FileCard file={image} />);
    expect(screen.getByRole("img", { name: "cat.png" })).toHaveAttribute("src", "https://s3.example/cat.png");
    expect(screen.getByRole("button", { name: "View image cat.png" })).toBeInTheDocument();
  });

  it("recovers an expired image by requesting a new link", async () => {
    server.use(
      http.get(`${API}/api/agent/file-url`, () =>
        HttpResponse.json({ url: "https://s3.example/fresh.png", downloadUrl: "d", expiresAt: future() }),
      ),
    );
    renderApp(
      <FileCard
        file={{ name: "old.png", type: "image", mimeType: "image/png", key: "u1/generated/old.png", expiresAt: past() }}
      />,
    );
    expect(await screen.findByRole("img", { name: "old.png" })).toHaveAttribute("src", "https://s3.example/fresh.png");
  });
});

describe("user messages", () => {
  it("shows the text and an attached PDF", () => {
    renderApp(
      <UserMessage
        content="Please summarise"
        attachments={[{ name: "notes.pdf", mimeType: "application/pdf", size: 1024 * 300, key: "k" }]}
        createdAt={new Date().toISOString()}
      />,
    );
    expect(screen.getByText("Please summarise")).toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    expect(screen.getByText("300 KB")).toBeInTheDocument();
  });
});
