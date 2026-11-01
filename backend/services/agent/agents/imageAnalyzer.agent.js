import fs from "node:fs/promises";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";

import { getModel } from "../config/llmModels.js";
import { checkAgentLimit } from "../config/agentLimit.js";
import { HttpError } from "../../../shared/http/errors.js";
import { toAgentError } from "../utils/agentErrors.js";
import { textOf } from "../utils/llm.js";

// Image *understanding*. The uploaded temp file is removed by the controller.
export const imageAnalyzer = async (state) => {
  try {
    if (!state.file) {
      throw new HttpError(400, "FILE_REQUIRED", "Attach an image to analyse.");
    }

    await checkAgentLimit(state.userId, "image");

    const llm = await getModel("imageAnalyzer");

    const imageBuffer = await fs.readFile(state.file.path);
    const base64Image = imageBuffer.toString("base64");

    const messages = [
      new SystemMessage(
        `You are OmniAI image analyzer Agent.

        Rules:

        - Analyze only the uploaded image.
        - Answer the user's question accurately.
        - If text exists in the image, extract it.
        - If charts or tables exist, explain them.
        - If something is unclear, say/ask so.
        - Use Markdown when helpful.
        - Do not hallucinate.
        `,
      ),
      new HumanMessage({
        content: [
          {
            type: "text",
            text: state.prompt || "analyze the image",
          },
          {
            type: "image_url",
            image_url: {
              url: `data:${state.file.mimetype};base64,${base64Image}`,
            },
          },
        ],
      }),
    ];

    const response = await llm.invoke(messages);

    return {
      ...state,
      aiResponse: textOf(response),
    };
  } catch (error) {
    throw toAgentError(error, "Failed to analyse the image.");
  }
};
