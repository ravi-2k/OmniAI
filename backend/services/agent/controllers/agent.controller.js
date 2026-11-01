import fs from "node:fs/promises";

import { graph } from "../graph/graph.js";
import { clearMemory } from "../config/memory.js";
import { getConversation, saveMessages } from "../utils/chatClient.js";
import {
  assertOwnedKey,
  FILE_URL_TTL_SECONDS,
  storeFile,
  withUrls,
} from "../utils/fileStore.js";
import { getFromS3 } from "../utils/getFromS3.js";
import { HttpError } from "../../../shared/http/errors.js";

const AGENTS = [
  "auto",
  "chat",
  "search",
  "coding",
  "pdf",
  "ppt",
  "vision",
  "pdfRag",
  "imageAnalyzer",
];

// Agents that can run without any prompt text because the attachment is the input.
const FILE_DRIVEN = ["auto", "pdf", "vision", "pdfRag", "imageAnalyzer"];

const OBJECT_ID = /^[a-f\d]{24}$/i;
const PROMPT_MAX_LENGTH = Number(process.env.PROMPT_MAX_LENGTH) || 8000;

const readInput = (body, file) => {
  const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
  const conversationId = body?.conversationId;
  const selected =
    typeof body?.agent === "string" && body.agent ? body.agent : "auto";

  if (typeof conversationId !== "string" || !OBJECT_ID.test(conversationId)) {
    throw new HttpError(400, "INVALID_REQUEST", "A valid conversationId is required");
  }

  if (!AGENTS.includes(selected)) {
    throw new HttpError(400, "INVALID_AGENT", `Unknown agent '${selected}'`);
  }

  if (prompt.length > PROMPT_MAX_LENGTH) {
    throw new HttpError(
      400,
      "PROMPT_TOO_LONG",
      `Prompt is too long (max ${PROMPT_MAX_LENGTH} characters)`,
    );
  }

  if (!prompt && !(file && FILE_DRIVEN.includes(selected))) {
    throw new HttpError(400, "INVALID_REQUEST", "A prompt is required");
  }

  return { prompt, conversationId, selected };
};

export const agent = async (req, res) => {
  const file = req.file;

  try {
    const userId = req.userId;
    const { prompt, conversationId, selected } = readInput(req.body, file);

    // Ownership gate: 404 unless this conversation belongs to the caller.
    await getConversation(userId, conversationId);

    const attachments = file
      ? [
          await storeFile({
            userId,
            area: "uploads",
            name: file.originalname,
            buffer: await fs.readFile(file.path),
            mimeType: file.mimetype,
          }),
        ]
      : [];

    const result = await graph.invoke({
      prompt,
      conversationId,
      agent: selected,
      userId,
      file,
    });

    const answer = typeof result.aiResponse === "string" ? result.aiResponse : "";
    const images = result.images ?? [];
    const artifacts = result.artifacts ?? [];
    const files = result.files ?? [];
    const sources = result.sources ?? [];

    if (!answer.trim() && !files.length && !artifacts.length) {
      throw new HttpError(
        502,
        "EMPTY_RESPONSE",
        "The AI returned an empty response. Please try again.",
      );
    }

    // Persist the exchange only after the agent succeeded, so a failed
    // attempt leaves no orphaned user message behind.
    const [userMessage, assistantMessage] = await saveMessages(
      userId,
      conversationId,
      [
        { role: "user", content: prompt, attachments },
        {
          role: "assistant",
          content: answer,
          agent: result.agent,
          images,
          artifacts,
          files,
          sources,
        },
      ],
    );
    await clearMemory(conversationId);

    return res.status(200).json({
      answer,
      agent: result.agent,
      images,
      artifacts,
      sources,
      files: await Promise.all(files.map(withUrls)),
      attachments: await Promise.all(attachments.map(withUrls)),
      userMessage,
      assistantMessage,
    });
  } finally {
    if (file) {
      await fs.unlink(file.path).catch(() => {});
    }
  }
};

// Download URLs expire, so clients ask for a fresh one by S3 key.
export const fileUrl = async (req, res) => {
  const key = assertOwnedKey(req.userId, req.query.key);
  const name =
    typeof req.query.name === "string" && req.query.name
      ? req.query.name.slice(0, 120)
      : key.split("/").pop();

  const [url, downloadUrl] = await Promise.all([
    getFromS3(key, FILE_URL_TTL_SECONDS),
    getFromS3(key, FILE_URL_TTL_SECONDS, name),
  ]);

  return res.status(200).json({
    url,
    downloadUrl,
    expiresAt: new Date(Date.now() + FILE_URL_TTL_SECONDS * 1000).toISOString(),
  });
};
