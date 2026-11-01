// Single error contract for every service:
//   { success: false, code: "SOME_CODE", message: "Human readable message", ...extra }

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    this.code = code;
    this.data = { success: false, code, message, ...extra };
  }
}

const findHttpError = (error) => {
  let current = error;
  for (let depth = 0; current && depth < 5; depth++) {
    if (current instanceof HttpError) return current;
    current = current.cause;
  }
  return null;
};

export const errorHandler = (error, req, res, next) => {
  if (res.headersSent) return next(error);

  const httpError = findHttpError(error);
  if (httpError) {
    return res.status(httpError.status).json(httpError.data);
  }

  // Upstream service (axios) failures: forward 4xx contract, mask the rest.
  if (error?.isAxiosError) {
    const status = error.response?.status;
    const data = error.response?.data;
    if (status && status >= 400 && status < 500 && data?.code) {
      return res.status(status).json(data);
    }
    console.error("Upstream error :", error.message);
    return res.status(502).json({
      success: false,
      code: "UPSTREAM_ERROR",
      message: "A required service is unavailable. Please try again.",
    });
  }

  // The database is unreachable (e.g. Atlas IP not allowlisted, cluster paused).
  // Say so in the log and tell the client to retry, instead of a vague 500.
  const dbDown =
    ["MongooseServerSelectionError", "MongoServerSelectionError", "MongoNetworkError", "MongoNetworkTimeoutError"].includes(error?.name) ||
    /buffering timed out/i.test(error?.message ?? "");
  if (dbDown) {
    console.error(
      "Database unavailable:",
      String(error.message).replace(/\/\/[^@/\s]*@/g, "//<creds>@").slice(0, 200),
    );
    return res.status(503).json({
      success: false,
      code: "SERVICE_UNAVAILABLE",
      message: "The service is temporarily unavailable. Please try again shortly.",
    });
  }

  if (error?.name === "MulterError") {
    const tooLarge = error.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 400).json({
      success: false,
      code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
      message: tooLarge ? "File is too large." : "Invalid file upload.",
    });
  }

  if (error?.name === "ValidationError" || error?.name === "CastError") {
    return res.status(400).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Invalid request data.",
    });
  }

  // body-parser and other http-errors
  if (error?.status && error.status >= 400 && error.status < 500) {
    return res.status(error.status).json({
      success: false,
      code: "INVALID_REQUEST",
      message: "Invalid request.",
    });
  }

  console.error(error);
  return res.status(500).json({
    success: false,
    code: "INTERNAL_ERROR",
    message: "Something went wrong. Please try again.",
  });
};
