import redis from "../../../shared/redis/redis.js";
import { HttpError } from "../../../shared/http/errors.js";

const WINDOW_SECONDS = 60;

const Limits = {
  chat: 20,
  coding: 5,
  pdf: 5,
  ppt: 5,
  image: 5,
  search: 5,
};

export const checkAgentLimit = async (userId, agent) => {
  const max = Limits[agent] || Limits["chat"];
  const key = `rate:${userId}:${agent}`;
  const count = await redis.incr(key);

  // A key without a TTL would block the user forever, so (re)apply the window
  // whenever it is missing, not only on the first hit.
  let ttl = await redis.ttl(key);
  if (ttl < 0) {
    await redis.expire(key, WINDOW_SECONDS);
    ttl = WINDOW_SECONDS;
  }

  if (count > max) {
    const minutes = Math.floor(ttl / 60);
    const seconds = ttl % 60;
    const time = minutes > 0 ? ` ${minutes}m : ${seconds}s` : `${seconds}s`;

    throw new HttpError(
      429,
      "RATE_LIMITED",
      `You have reached the ${agent} limit (${max} requests/minute). Try again in ${time}.`,
      {
        agent,
        limit: max,
        remainingTime: ttl,
        retryAfter: time,
      },
    );
  }

  return {
    remaining: max - count,
    limit: max,
  };
};
