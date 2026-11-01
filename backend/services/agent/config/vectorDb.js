import { QdrantVectorStore } from "@langchain/qdrant";
import { QdrantClient } from "@qdrant/js-client-rest";

import { embeddings } from "./embeddings.js";

import dotenv from "dotenv";
dotenv.config();

const connection = () => ({
  url: process.env.QDRANT_URL,
  apiKey: process.env.QDRANT_API_KEY,
});

// One collection per conversation: a new upload replaces the previous PDF so
// follow-up questions always search the latest document.
export const pdfCollectionName = (conversationId) => `pdf-${conversationId}`;

export const vectorStore = async (docs, collectionName) => {
  try {
    await new QdrantClient(connection()).deleteCollection(collectionName);
  } catch {
    // collection did not exist yet
  }

  return await QdrantVectorStore.fromDocuments(docs, embeddings, {
    ...connection(),
    collectionName,
  });
};

// Returns null when the conversation has no indexed PDF yet.
export const openVectorStore = async (collectionName) => {
  try {
    return await QdrantVectorStore.fromExistingCollection(embeddings, {
      ...connection(),
      collectionName,
    });
  } catch {
    return null;
  }
};
