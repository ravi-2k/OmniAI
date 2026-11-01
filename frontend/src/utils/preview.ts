import type { Artifact, ArtifactFile } from "@/types/api";

/**
 * Generated pages run in a sandboxed iframe (no same-origin access), and this CSP
 * additionally forbids network requests, nested frames, form posts and external
 * scripts. Images and fonts over https are allowed so typical landing pages render.
 */
export const PREVIEW_CSP = [
  "default-src 'none'",
  "img-src https: data: blob:",
  "media-src https: data: blob:",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https: data:",
  "script-src 'unsafe-inline'",
  "form-action 'none'",
].join("; ");

export const PREVIEW_ERROR_MESSAGE = "omniai-preview-error";

const normalizePath = (value: string) =>
  value
    .trim()
    .replace(/^\.\//, "")
    .replace(/^\/+/, "")
    .split(/[?#]/)[0]!;

const isExternal = (value: string) => /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(value.trim());

const findFile = (files: ArtifactFile[], reference: string) => {
  const wanted = normalizePath(reference);
  return (
    files.find((file) => normalizePath(file.name) === wanted) ??
    files.find((file) => normalizePath(file.name).split("/").pop() === wanted.split("/").pop())
  );
};

export const getEntryFile = (artifact: Artifact): ArtifactFile | undefined =>
  artifact.files.find((file) => file.name === artifact.entry && /\.html?$/i.test(file.name)) ??
  artifact.files.find((file) => /\.html?$/i.test(file.name));

export const isPreviewable = (artifact: Artifact) => !!getEntryFile(artifact);

// Reports runtime errors to the parent so the UI can surface them.
const ERROR_REPORTER = `
window.addEventListener("error", function (e) {
  parent.postMessage({ type: "${PREVIEW_ERROR_MESSAGE}", message: String(e.message || "Script error") }, "*");
});
window.addEventListener("unhandledrejection", function (e) {
  parent.postMessage({ type: "${PREVIEW_ERROR_MESSAGE}", message: String((e.reason && e.reason.message) || e.reason || "Unhandled promise rejection") }, "*");
});`;

/**
 * Builds a self-contained HTML document for `srcdoc`: local stylesheets and scripts
 * referenced by the entry file are inlined from the artifact's files.
 * Returns null when the artifact has no HTML entry.
 */
export const buildPreviewDoc = (artifact: Artifact): string | null => {
  const entry = getEntryFile(artifact);
  if (!entry) return null;

  const doc = new DOMParser().parseFromString(entry.content, "text/html");

  doc.querySelectorAll('link[rel~="stylesheet"][href]').forEach((link) => {
    const href = link.getAttribute("href") ?? "";
    if (isExternal(href)) return;
    const file = findFile(artifact.files, href);
    if (!file) return;
    const style = doc.createElement("style");
    style.textContent = file.content;
    link.replaceWith(style);
  });

  doc.querySelectorAll("script[src]").forEach((script) => {
    const src = script.getAttribute("src") ?? "";
    if (isExternal(src)) {
      // Blocked by the CSP anyway; remove so it doesn't log noise.
      script.remove();
      return;
    }
    const file = findFile(artifact.files, src);
    if (!file) {
      script.remove();
      return;
    }
    const inline = doc.createElement("script");
    // A literal "</script" in the source would end the inline block early.
    inline.textContent = file.content.replace(/<\/script/gi, "<\\/script");
    script.replaceWith(inline);
  });

  const csp = doc.createElement("meta");
  csp.setAttribute("http-equiv", "Content-Security-Policy");
  csp.setAttribute("content", PREVIEW_CSP);

  const reporter = doc.createElement("script");
  reporter.textContent = ERROR_REPORTER;

  // Both must run before any page script, so put them first in <head>.
  doc.head.prepend(reporter);
  doc.head.prepend(csp);

  return `<!doctype html>\n${doc.documentElement.outerHTML}`;
};
