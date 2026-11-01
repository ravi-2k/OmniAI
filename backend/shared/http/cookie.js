// Session cookie options, shared by login (set) and logout / expiry (clear).
// clearCookie only works when these options match the ones used to set it.
//
//   COOKIE_SECURE   "true" | "false"  (default: true when NODE_ENV=production)
//   COOKIE_SAMESITE "strict" | "lax" | "none"  (default: strict)
//   COOKIE_DOMAIN   optional, e.g. ".example.com" to share across app./api.
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

export const sessionCookieOptions = () => {
  const sameSite = (process.env.COOKIE_SAMESITE || "strict").toLowerCase();
  const secure =
    sameSite === "none" ||
    (process.env.COOKIE_SECURE
      ? process.env.COOKIE_SECURE === "true"
      : process.env.NODE_ENV === "production");

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: "/",
    ...(process.env.COOKIE_DOMAIN ? { domain: process.env.COOKIE_DOMAIN } : {}),
  };
};
