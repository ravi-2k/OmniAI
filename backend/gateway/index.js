import "dotenv/config";
import express from "express";
import proxy from "express-http-proxy";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";

import { getUser } from "./controllers/user.controller.js";
import { protect } from "./middlewares/auth.middleware.js";
import { proxyPublic, proxyWithHeaders } from "./utils/proxy.utils.js";
import { errorHandler, HttpError } from "../shared/http/errors.js";

const PORT = process.env.PORT;

// FRONTEND_URL may be a single origin or a comma separated list.
const allowedOrigins = (process.env.FRONTEND_URL || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const app = express();

app.disable("x-powered-by");
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : false,
    credentials: true,
  }),
);

app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to Gateway Service" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Message persistence is internal: the agent service writes messages, clients
// must not be able to forge them.
app.all(
  ["/api/chat/save-message", "/api/chat/save-messages"],
  (req, res, next) => next(new HttpError(404, "NOT_FOUND", "Not found")),
);

app.use("/api/user", protect, getUser);
app.use("/api/auth", proxyPublic(process.env.AUTH_SERVICE));
app.use("/api/chat", protect, proxyWithHeaders(process.env.CHAT_SERVICE));
// Streamed (not buffered) so file uploads are not capped by the proxy body
// limit; LLM calls can be slow, so allow a longer timeout.
app.use(
  "/api/agent",
  protect,
  proxyWithHeaders(process.env.AGENT_SERVICE, {
    streamBody: true,
    timeout: Number(process.env.AGENT_TIMEOUT_MS) || 180000,
  }),
);

app.use((req, res, next) =>
  next(new HttpError(404, "NOT_FOUND", "Route not found")),
);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Gateway Server connected to port ${PORT}`);
});
