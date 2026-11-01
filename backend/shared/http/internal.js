import crypto from "node:crypto";

import { HttpError } from "./errors.js";

const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
};

// Services only trust the gateway. When INTERNAL_API_KEY is set, requests
// without the matching x-internal-key header are rejected.
export const requireInternal = (req, res, next) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (expected && !safeEqual(req.headers["x-internal-key"] ?? "", expected)) {
    return next(new HttpError(401, "UNAUTHORIZED", "Unauthorized"));
  }
  next();
};

export const requireUser = (req, res, next) => {
  const userId = req.headers["x-user-id"];
  if (!userId || typeof userId !== "string") {
    return next(new HttpError(401, "UNAUTHORIZED", "Unauthorized"));
  }
  req.userId = userId;
  next();
};

export const internalHeaders = (userId) => ({
  ...(process.env.INTERNAL_API_KEY
    ? { "x-internal-key": process.env.INTERNAL_API_KEY }
    : {}),
  ...(userId ? { "x-user-id": String(userId) } : {}),
});
