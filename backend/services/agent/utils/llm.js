import { HttpError } from "../../../shared/http/errors.js";

// LangChain message content is a string for most providers but can be an
// array of parts (Gemini etc). Always return plain text.
export const textOf = (response) => {
  const content = response?.content ?? response;

  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === "string" ? part : (part?.text ?? "")))
      .join("");
  }

  return String(content ?? "");
};

const badResponse = () =>
  new HttpError(
    502,
    "BAD_AI_RESPONSE",
    "The AI returned an unreadable response. Please try again.",
  );

// Models often wrap JSON in ``` fences or add a sentence around it.
export const parseJsonFromLlm = (text) => {
  let body = String(text ?? "").trim();

  const fenced = body.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) body = fenced[1].trim();

  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) throw badResponse();

  try {
    return JSON.parse(body.slice(start, end + 1));
  } catch {
    throw badResponse();
  }
};

export const str = (value) =>
  typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";

export const strArray = (value) =>
  (Array.isArray(value) ? value : []).map(str).filter(Boolean);

export const shortTitle = (text, max = 60) => {
  const clean = String(text ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
};

export const slugify = (text, fallback = "file") => {
  const slug = String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
};

const LANGUAGES = {
  html: "html",
  htm: "html",
  css: "css",
  scss: "scss",
  js: "javascript",
  mjs: "javascript",
  cjs: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  json: "json",
  md: "markdown",
  py: "python",
  java: "java",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  go: "go",
  rs: "rust",
  rb: "ruby",
  php: "php",
  sh: "shell",
  yml: "yaml",
  yaml: "yaml",
  xml: "xml",
  sql: "sql",
  svg: "xml",
  txt: "plaintext",
};

export const languageFromFilename = (name) => {
  const extension = String(name).split(".").pop()?.toLowerCase();
  return LANGUAGES[extension] || "plaintext";
};
