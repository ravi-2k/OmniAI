import express from "express";

import { agent, fileUrl } from "../controllers/agent.controller.js";
import upload from "../config/multer.js";
import { requireUser } from "../../../shared/http/internal.js";

const router = express.Router();

router.use(requireUser);

router.post("/chat", upload.single("file"), agent);
router.get("/file-url", fileUrl);

export default router;
