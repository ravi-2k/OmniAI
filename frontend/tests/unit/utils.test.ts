import { describe, expect, it } from "vitest";

import { toBackendAgent } from "@/config/agents";
import { ApiError, errorFromResponse, userMessage } from "@/services/api/errors";
import { groupConversations } from "@/utils/dates";
import { zipName } from "@/utils/download";
import { acceptAttribute, formatBytes, validateFile } from "@/utils/files";
import { buildPreviewDoc, getEntryFile, isPreviewable, PREVIEW_CSP } from "@/utils/preview";
import { conversation, htmlArtifact } from "../fixtures";

const file = (name: string, type: string, size = 1000) => {
  const f = new File(["x"], name, { type });
  Object.defineProperty(f, "size", { value: size });
  return f;
};

describe("file validation", () => {
  it("accepts a PDF and images where allowed", () => {
    expect(validateFile(file("a.pdf", "application/pdf"), "pdf")).toBeNull();
    expect(validateFile(file("a.png", "image/png"), "image")).toBeNull();
    expect(validateFile(file("a.pdf", "application/pdf"), "pdf-or-image")).toBeNull();
    expect(validateFile(file("a.heic", "image/heic"), "image")).toBeNull();
  });

  it("rejects the wrong type for an agent", () => {
    expect(validateFile(file("a.png", "image/png"), "pdf")).toMatch(/only accepts PDF/i);
    expect(validateFile(file("a.pdf", "application/pdf"), "image")).toMatch(/only accepts images/i);
    expect(validateFile(file("a.txt", "text/plain"), "pdf-or-image")).toMatch(/Only PDFs and images/);
  });

  it("rejects attachments for agents that don't use them", () => {
    expect(validateFile(file("a.pdf", "application/pdf"), "none")).toMatch(/doesn't use attachments/);
  });

  it("enforces the 20 MB limit and rejects empty files", () => {
    expect(validateFile(file("big.pdf", "application/pdf", 21 * 1024 * 1024), "pdf")).toMatch(/too large/);
    expect(validateFile(file("ok.pdf", "application/pdf", 20 * 1024 * 1024), "pdf")).toBeNull();
    expect(validateFile(file("empty.pdf", "application/pdf", 0), "pdf")).toMatch(/empty/);
  });

  it("formats sizes and accept attributes", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2.0 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(acceptAttribute("pdf")).toBe("application/pdf");
    expect(acceptAttribute("none")).toBe("");
  });
});

describe("conversation grouping", () => {
  const now = new Date(2026, 9, 30, 15, 0, 0);
  const at = (daysAgo: number, hour = 10) =>
    new Date(2026, 9, 30 - daysAgo, hour).toISOString();

  it("groups by real updatedAt and omits empty groups", () => {
    const groups = groupConversations(
      [
        conversation({ _id: "a", updatedAt: at(0) }),
        conversation({ _id: "b", updatedAt: at(1) }),
        conversation({ _id: "c", updatedAt: at(4) }),
        conversation({ _id: "d", updatedAt: at(30) }),
      ],
      now,
    );
    expect(groups.map((g) => [g.label, g.items.map((i) => i._id)])).toEqual([
      ["Today", ["a"]],
      ["Yesterday", ["b"]],
      ["Previous 7 days", ["c"]],
      ["Older", ["d"]],
    ]);
    expect(groupConversations([conversation({ updatedAt: at(0) })], now)).toHaveLength(1);
  });
});

describe("agent mapping", () => {
  it("sends the UI agent through unchanged", () => {
    expect(toBackendAgent("auto", { hasFile: false, askAboutPdf: true })).toBe("auto");
    expect(toBackendAgent("coding", { hasFile: false, askAboutPdf: true })).toBe("coding");
    expect(toBackendAgent("vision", { hasFile: true, askAboutPdf: true })).toBe("vision");
    expect(toBackendAgent("pdf", { hasFile: true, askAboutPdf: true })).toBe("pdf");
  });

  it("asks about the conversation's PDF only when no new file is attached", () => {
    expect(toBackendAgent("pdf", { hasFile: false, askAboutPdf: true })).toBe("pdfRag");
    expect(toBackendAgent("pdf", { hasFile: false, askAboutPdf: false })).toBe("pdf");
  });
});

describe("error mapping", () => {
  it("parses the backend error contract", () => {
    const error = errorFromResponse(429, JSON.stringify({ success: false, code: "RATE_LIMITED", message: "Slow down", remainingTime: 42 }));
    expect(error).toBeInstanceOf(ApiError);
    expect([error.status, error.code, error.remainingTime]).toEqual([429, "RATE_LIMITED", 42]);
  });

  it("falls back by status when the body isn't JSON", () => {
    expect(errorFromResponse(401, "<html>").code).toBe("UNAUTHORIZED");
    expect(errorFromResponse(413, "").code).toBe("FILE_TOO_LARGE");
    expect(errorFromResponse(502, "bad gateway").code).toBe("SERVER_ERROR");
  });

  it("never leaks backend internals for unknown codes", () => {
    const leaky = new ApiError(500, "SOMETHING_NEW", "MongoServerError: E11000 duplicate key at /app/db.js:12");
    expect(userMessage(leaky)).toBe("Something went wrong. Please try again.");
    expect(userMessage(new Error("boom"))).toBe("Something went wrong. Please try again.");
  });

  it("shows the backend's explanation only for vetted codes", () => {
    expect(userMessage(new ApiError(429, "RATE_LIMITED", "Try again in 5s."))).toBe("Try again in 5s.");
    expect(userMessage(new ApiError(0, "NETWORK_ERROR", "x"))).toMatch(/Can't reach the server/);
  });
});

describe("preview document", () => {
  it("inlines local CSS and JS and puts the CSP first in <head>", () => {
    const doc = buildPreviewDoc(htmlArtifact())!;
    expect(doc).toContain("<style>h1{color:red}</style>");
    expect(doc).toContain("console.log('hi')");
    expect(doc).not.toContain('href="style.css"');
    expect(doc).not.toContain('src="script.js"');

    const parsed = new DOMParser().parseFromString(doc, "text/html");
    const first = parsed.head.firstElementChild!;
    expect(first.tagName).toBe("META");
    expect(first.getAttribute("http-equiv")).toBe("Content-Security-Policy");
    expect(first.getAttribute("content")).toBe(PREVIEW_CSP);
  });

  it("removes external scripts instead of loading them", () => {
    const artifact = htmlArtifact();
    artifact.files[0]!.content =
      '<html><head></head><body><script src="https://evil.example/x.js"></script><script src="//cdn.example/y.js"></script></body></html>';
    const doc = buildPreviewDoc(artifact)!;
    expect(doc).not.toContain("evil.example");
    expect(doc).not.toContain("cdn.example");
  });

  it("can't be broken out of by a literal </script> in a script file", () => {
    const artifact = htmlArtifact();
    artifact.files[2]!.content = 'document.write("</script><img src=x onerror=alert(1)>")';
    const doc = buildPreviewDoc(artifact)!;
    const parsed = new DOMParser().parseFromString(doc, "text/html");
    expect(parsed.querySelector("img[onerror]")).toBeNull();
  });

  it("forbids network access and frames in the CSP", () => {
    expect(PREVIEW_CSP).toContain("default-src 'none'");
    expect(PREVIEW_CSP).not.toMatch(/connect-src/);
    expect(PREVIEW_CSP).toContain("form-action 'none'");
  });

  it("only previews artifacts that have an HTML entry", () => {
    const code = { ...htmlArtifact(), files: [{ name: "main.py", content: "print(1)" }], entry: "main.py" };
    expect(isPreviewable(code)).toBe(false);
    expect(buildPreviewDoc(code)).toBeNull();
    expect(getEntryFile(htmlArtifact())?.name).toBe("index.html");
  });
});

describe("zip naming", () => {
  it("slugifies the title", () => {
    expect(zipName({ ...htmlArtifact(), title: "My Café Landing Page!!" })).toBe("my-caf-landing-page.zip");
    expect(zipName({ ...htmlArtifact(), title: "" })).toBe("project.zip");
  });
});
