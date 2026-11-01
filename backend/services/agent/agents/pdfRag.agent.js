import fs from "node:fs/promises";
import { PDFParse } from "pdf-parse";

import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { getModel } from "../config/llmModels.js";
import {
  openVectorStore,
  pdfCollectionName,
  vectorStore,
} from "../config/vectorDb.js";
import { checkAgentLimit } from "../config/agentLimit.js";
import { HttpError } from "../../../shared/http/errors.js";
import { toAgentError } from "../utils/agentErrors.js";
import { textOf } from "../utils/llm.js";

const MAX_TEXT_CHARS = 2000000;

const indexUploadedPdf = async (file, collectionName) => {
  const buffer = await fs.readFile(file.path);
  const pdf = new PDFParse({
    data: buffer,
  });

  let text;
  try {
    text = (await pdf.getText()).text || "";
  } finally {
    try {
      await pdf.destroy?.();
    } catch {
      // best-effort cleanup of the parser
    }
  }

  if (!text.trim()) {
    throw new HttpError(
      422,
      "EMPTY_PDF",
      "No readable text was found in this PDF (scanned PDFs are not supported).",
    );
  }

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  const docs = await splitter.createDocuments(
    [text.slice(0, MAX_TEXT_CHARS)],
    [{ source: file.originalname }],
  );

  return await vectorStore(docs, collectionName);
};

// Answers from the PDF attached to this request or, when no file is sent,
// from the PDF most recently uploaded to this conversation.
export const pdfRag = async (state) => {
  try {
    await checkAgentLimit(state.userId, "pdf");

    const collectionName = pdfCollectionName(state.conversationId);

    const store = state.file
      ? await indexUploadedPdf(state.file, collectionName)
      : await openVectorStore(collectionName);

    if (!store) {
      throw new HttpError(
        400,
        "NO_PDF",
        "Attach a PDF first, then ask your question.",
      );
    }

    const question = state.prompt || "Summarize this document.";

    const relevantDocs = await store.similaritySearch(question, 5);

    const context = relevantDocs.map((d) => d.pageContent).join("\n\n");

    const llm = await getModel("pdf-rag");

    const messages = [
      new SystemMessage(`You are OmniAI PDF Assistant.

        Rules:

        - Answer ONLY from the uploaded PDF.

        - Never make up information.

        - If the answer is not present in the PDF, reply:

        "I couldn't find this information in the uploaded PDF."

        - Use Markdown formatting.
      `),

      new HumanMessage(`
        Context:${context}
        Question:${question}
      `),
    ];

    const response = await llm.invoke(messages);

    return {
      ...state,
      aiResponse: textOf(response),
    };
  } catch (error) {
    throw toAgentError(error, "Failed to analyse the PDF.");
  }
};
