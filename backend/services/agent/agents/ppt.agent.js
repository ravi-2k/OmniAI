import { getModel } from "../config/llmModels.js";
import { generatePpt } from "../utils/generatePpt.js";
import { storeFile } from "../utils/fileStore.js";
import { checkAgentLimit } from "../config/agentLimit.js";
import { HttpError } from "../../../shared/http/errors.js";
import { toAgentError } from "../utils/agentErrors.js";
import {
  parseJsonFromLlm,
  shortTitle,
  slugify,
  str,
  strArray,
  textOf,
} from "../utils/llm.js";

const normalize = (data, topic) => {
  const slides = (Array.isArray(data?.slides) ? data.slides : [])
    .map((slide) => ({
      title: str(slide?.title),
      points: strArray(slide?.points),
    }))
    .filter((slide) => slide.title || slide.points.length);

  if (!slides.length) {
    throw new HttpError(
      502,
      "BAD_AI_RESPONSE",
      "The AI did not produce any slides. Please try again.",
    );
  }

  return {
    title: str(data?.title) || shortTitle(topic, 80) || "Presentation",
    subtitle: str(data?.subtitle),
    slides,
  };
};

export const pptAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "ppt");
    const llm = await getModel("ppt");
    const prompt = `You are a professional presentation designer.

        Return ONLY valid JSON.

        Format:
        {
            "title":"",
            "subtitle":"",
            "slides":[
                {
                    "title":"",
                    "points":[
                        "",
                        "",
                        "",
                        ""
                    ]
                }
            ]
        }

        Rules:

        - Generate exactly 6 content slides.
        - Each slide should have 4-6 concise bullet points.
        - No markdown.
        - No explanation.
        - No code block.
        - Return ONLY JSON.

        Topic:

        ${state.prompt}
    `;

    const res = await llm.invoke(prompt);
    const data = normalize(parseJsonFromLlm(textOf(res)), state.prompt);

    const ppt = await generatePpt(data);
    const buffer = await ppt.write({
      outputType: "nodebuffer",
    });

    const file = await storeFile({
      userId: state.userId,
      area: "generated",
      name: `${slugify(data.title, "presentation")}.pptx`,
      buffer,
      mimeType:
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      type: "ppt",
    });

    return {
      ...state,
      files: [file],
      aiResponse: `# Presentation Generated

**${data.title}**

Your presentation is ready to download.`,
    };
  } catch (error) {
    throw toAgentError(error, "Failed to generate the presentation.");
  }
};
