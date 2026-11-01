import axios from "axios";

import { getModel } from "../config/llmModels.js";
import { storeFile } from "../utils/fileStore.js";
import { checkAgentLimit } from "../config/agentLimit.js";
import { HttpError } from "../../../shared/http/errors.js";
import { toAgentError } from "../utils/agentErrors.js";
import { slugify, textOf } from "../utils/llm.js";

const EXTENSIONS = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

// Image *generation*. (Understanding an uploaded image is imageAnalyzer.)
export const visionAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "image");
    const llm = await getModel("image");
    const res = await llm.invoke(`
        You are an elite AI image prompt engineer.

        Convert the user request into a highly detailed image generation prompt.

        Requirements:

        - Cinematic lighting
        - Professional composition
        - Ultra realistic
        - High detail
        - Beautiful color palette
        - Sharp focus
        - 8K quality
        - Photorealistic
        - Depth of field
        - Professional photography
        - Stunning visuals

        Return only the image prompt.

        User Request: ${state.prompt}
    `);

    const prompt = textOf(res).trim().slice(0, 1500);

    const imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}`;

    const imageRes = await axios.get(imageUrl, {
      responseType: "arraybuffer",
      timeout: 90000,
    });

    const contentType = String(imageRes.headers["content-type"] || "")
      .split(";")[0]
      .trim()
      .toLowerCase();

    if (!contentType.startsWith("image/")) {
      throw new HttpError(
        502,
        "IMAGE_GENERATION_FAILED",
        "Image generation failed. Please try again.",
      );
    }

    const buffer = Buffer.from(imageRes.data);
    const extension = EXTENSIONS[contentType] || "png";

    const file = await storeFile({
      userId: state.userId,
      area: "generated",
      name: `${slugify(state.prompt, "image")}.${extension}`,
      buffer,
      mimeType: contentType,
      type: "image",
    });

    return {
      ...state,
      files: [file],
      aiResponse: "Here is your generated image.",
    };
  } catch (error) {
    throw toAgentError(error, "Failed to generate the image.");
  }
};
