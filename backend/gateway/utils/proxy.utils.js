import proxy from "express-http-proxy";

import { internalHeaders } from "../../shared/http/internal.js";

const DEFAULT_TIMEOUT_MS = 30000;

const proxyErrorHandler = (error, res, next) => {
  switch (error?.code) {
    case "ETIMEDOUT":
    case "ESOCKETTIMEDOUT":
    case "ECONNRESET":
      return res.status(504).json({
        success: false,
        code: "GATEWAY_TIMEOUT",
        message: "The request took too long. Please try again.",
      });
    case "ECONNREFUSED":
    case "ENOTFOUND":
      return res.status(502).json({
        success: false,
        code: "SERVICE_UNAVAILABLE",
        message: "Service unavailable. Please try again shortly.",
      });
    default:
      return next(error);
  }
};

const build = (url, { userAware, streamBody = false, timeout }) =>
  proxy(url, {
    timeout: timeout || DEFAULT_TIMEOUT_MS,
    parseReqBody: !streamBody,
    proxyErrorHandler,
    proxyReqOptDecorator: (proxyOptReq, sourceReq) => {
      // Never trust identity headers coming from the client.
      delete proxyOptReq.headers["x-user-id"];
      delete proxyOptReq.headers["x-internal-key"];

      proxyOptReq.headers = {
        ...proxyOptReq.headers,
        ...internalHeaders(userAware ? sourceReq.user?.userId : undefined),
      };
      return proxyOptReq;
    },
  });

// Authenticated routes: forwards the session user as x-user-id.
export const proxyWithHeaders = (url, options = {}) =>
  build(url, { ...options, userAware: true });

// Public routes (login / logout): no user identity is forwarded.
export const proxyPublic = (url, options = {}) =>
  build(url, { ...options, userAware: false });
