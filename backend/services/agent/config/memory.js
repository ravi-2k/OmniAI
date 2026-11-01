import redis from "../../../shared/redis/redis.js";
import { getMessages } from "../utils/chatClient.js";

const MEMORY_LIMIT = 20;
const MEMORY_TTL_SECONDS = 24 * 60 * 60;

const memoryKey = (conversationId) => `messages-${conversationId}`;

// The database is the source of truth; Redis only caches the last
// MEMORY_LIMIT messages (oldest -> newest) as { role, content }.
export const getMemory = async (conversationId, userId) => {
  const key = memoryKey(conversationId);
  const cached = await redis.get(key);

  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed)) return parsed;
    } catch {
      // fall through and rebuild from the database
    }
  }

  const messages = await getMessages(userId, conversationId, MEMORY_LIMIT);
  const memory = messages
    .filter((message) => message.content)
    .map(({ role, content }) => ({ role, content }));

  await redis.set(key, JSON.stringify(memory), "EX", MEMORY_TTL_SECONDS);

  return memory;
};

// Call after new messages are persisted so the next request reloads them.
export const clearMemory = async (conversationId) => {
  await redis.del(memoryKey(conversationId));
};
