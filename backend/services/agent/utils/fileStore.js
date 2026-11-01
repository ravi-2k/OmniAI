import crypto from "node:crypto";

import { uploadToS3 } from "./uploadToS3.js";
import { getFromS3 } from "./getFromS3.js";
import { HttpError } from "../../../shared/http/errors.js";

export const FILE_URL_TTL_SECONDS =
  Number(process.env.FILE_URL_TTL_SECONDS) || 3600;

const safeName = (name) =>
  String(name || "file")
    .split(/[\\/]/)
    .pop()
    .replace(/[^A-Za-z0-9._-]/g, "_")
    .slice(0, 100) || "file";

// Keys are namespaced by user id: <userId>/<area>/<timestamp>-<rand>-<name>
export const buildKey = (userId, area, name) =>
  `${userId}/${area}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName(name)}`;

// Uploads to S3 and returns a descriptor that is safe to persist (no URLs,
// which expire).
export const storeFile = async ({
  userId,
  area,
  name,
  buffer,
  mimeType,
  type,
}) => {
  const key = buildKey(userId, area, name);
  await uploadToS3(key, buffer, mimeType);

  return {
    name: safeName(name),
    ...(type ? { type } : {}),
    mimeType,
    size: buffer.length,
    key,
  };
};

// Adds fresh signed URLs: `url` for inline use (previews), `downloadUrl` for
// saving under the file's own name.
export const withUrls = async (file) => {
  const [url, downloadUrl] = await Promise.all([
    getFromS3(file.key, FILE_URL_TTL_SECONDS),
    getFromS3(file.key, FILE_URL_TTL_SECONDS, file.name),
  ]);

  return {
    ...file,
    url,
    downloadUrl,
    expiresAt: new Date(Date.now() + FILE_URL_TTL_SECONDS * 1000).toISOString(),
  };
};

export const assertOwnedKey = (userId, key) => {
  if (
    typeof key !== "string" ||
    key.length > 300 ||
    key.includes("..") ||
    !key.startsWith(`${userId}/`)
  ) {
    throw new HttpError(403, "FORBIDDEN", "You don't have access to this file");
  }
  return key;
};
