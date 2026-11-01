import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";
import router from "./routes/auth.route.js";
import { errorHandler } from "../../shared/http/errors.js";
import { requireInternal } from "../../shared/http/internal.js";

const PORT = process.env.PORT;

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "20kb" }));
app.use(cookieParser());

app.get("/", (req, res) => {
  res.json({ message: "Welcome to Auth Service" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(requireInternal);
app.use("/", router);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Auth Server connected to port ${PORT}`);
  connectDB();
});
