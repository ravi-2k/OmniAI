import express from "express";

import {
  createConversation,
  getConversations,
  getConversation,
  updateConversation,
  deleteConversation,
  saveMessage,
  saveMessages,
  getMessages,
  setFeedback,
} from "../controllers/chat.controller.js";
import { requireUser } from "../../../shared/http/internal.js";

const router = express.Router();

router.use(requireUser);

router.get("/create-conversation", createConversation);
router.post("/create-conversation", createConversation);
router.get("/get-conversation", getConversations);
router.get("/conversation/:conversationId", getConversation);
router.post("/update-conversation", updateConversation);
router.delete("/delete-conversation/:conversationId", deleteConversation);
router.post("/save-message", saveMessage);
router.post("/save-messages", saveMessages);
router.get("/get-messages/:conversationId", getMessages);
router.post("/feedback", setFeedback);

export default router;
