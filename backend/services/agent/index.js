import "dotenv/config";
import express from "express";

import connectDB from "./config/db.js";
import router from "./routes/agent.route.js";
import { errorHandler } from "../../shared/http/errors.js";
import { requireInternal } from "../../shared/http/internal.js";

const PORT = process.env.PORT;

const app = express();

app.disable("x-powered-by");
app.use(express.json({ limit: "100kb" }));

app.get("/", (req, res) => {
  res.json({ message: "Welcome to Agent Service" });
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use(requireInternal);
app.use("/", router);
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Agent Server connected to port ${PORT}`);
  connectDB();
});
