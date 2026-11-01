import redis from "../../shared/redis/redis.js";
import { HttpError } from "../../shared/http/errors.js";
import { sessionCookieOptions } from "../../shared/http/cookie.js";

export const protect = async (req, res, next) => {
  try {
    const sessionId = req.cookies?.session;

    if (!sessionId) {
      throw new HttpError(401, "UNAUTHORIZED", "Unauthorized");
    }

    const session = await redis.get(`session-${sessionId}`);

    if (!session) {
      res.clearCookie("session", sessionCookieOptions());
      throw new HttpError(401, "SESSION_EXPIRED", "Session expired");
    }

    req.user = JSON.parse(session);
    next();
  } catch (error) {
    next(error);
  }
};
