import crypto from "node:crypto";
import { getAuth } from "firebase-admin/auth";

import { app } from "../config/firebase.js";
import User from "../models/user.model.js";
import redis from "../../../shared/redis/redis.js";
import { HttpError } from "../../../shared/http/errors.js";
import {
  SESSION_TTL_SECONDS,
  sessionCookieOptions,
} from "../../../shared/http/cookie.js";

export const login = async (req, res) => {
  const { token } = req.body ?? {};

  if (typeof token !== "string" || !token.trim()) {
    throw new HttpError(400, "INVALID_REQUEST", "Firebase ID token is required");
  }

  let decoded;
  try {
    decoded = await getAuth(app).verifyIdToken(token);
  } catch (error) {
    throw new HttpError(401, "INVALID_TOKEN", "Invalid or expired sign-in token");
  }

  if (!decoded?.uid) {
    throw new HttpError(401, "INVALID_TOKEN", "Invalid or expired sign-in token");
  }

  // Upsert keeps concurrent first logins from creating duplicate users and
  // keeps the profile in sync with the Google account.
  const profile = {};
  if (decoded.name) profile.name = decoded.name;
  if (decoded.email) profile.email = decoded.email;
  if (decoded.picture) profile.avatar = decoded.picture;

  const user = await User.findOneAndUpdate(
    { firebaseUid: decoded.uid },
    { $set: profile, $setOnInsert: { firebaseUid: decoded.uid } },
    { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
  );

  const sessionId = crypto.randomBytes(32).toString("hex");

  await redis.set(
    `session-${sessionId}`,
    JSON.stringify({
      userId: String(user._id),
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    }),
    "EX",
    SESSION_TTL_SECONDS,
  );

  res.cookie("session", sessionId, {
    ...sessionCookieOptions(),
    maxAge: SESSION_TTL_SECONDS * 1000,
  });

  return res.status(200).json({
    _id: user._id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
  });
};

export const logout = async (req, res) => {
  const sessionId = req.cookies?.session;

  if (sessionId) {
    await redis.del(`session-${sessionId}`);
  }

  res.clearCookie("session", sessionCookieOptions());
  return res.status(200).json({ message: "Logout Successful" });
};
