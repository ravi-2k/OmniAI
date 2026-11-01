import { getModel } from "../config/llmModels.js";
import { generatePdf } from "../utils/generatePdf.js";
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
  const sections = (Array.isArray(data?.sections) ? data.sections : [])
    .map((section) => ({
      heading: str(section?.heading),
      points: strArray(section?.points),
    }))
    .filter((section) => section.heading || section.points.length);

  if (!sections.length) {
    throw new HttpError(
      502,
      "BAD_AI_RESPONSE",
      "The AI did not produce any content. Please try again.",
    );
  }

  return {
    title: str(data?.title) || shortTitle(topic, 80) || "Document",
    subtitle: str(data?.subtitle),
    sections,
  };
};

export const pdfAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "pdf");

    const llm = await getModel("pdf");
    const prompt = `
        You are an expert document writer.

        Return ONLY valid JSON.

        Do NOT return markdown.

        Do NOT return explanations.

        Structure:
        {
            "title":"",
            "subtitle":"",
            "sections":[
                {
                "heading":"",
                "points":[]
                }
            ]
        }

        Generate 4-8 sections.

        Each section should have 3-6 concise bullet points.

        Topic: ${state.prompt}
    `;

    const res = await llm.invoke(prompt);
    const data = normalize(parseJsonFromLlm(textOf(res)), state.prompt);

    const pdfBuffer = await generatePdf(data);

    const file = await storeFile({
      userId: state.userId,
      area: "generated",
      name: `${slugify(data.title, "document")}.pdf`,
      buffer: pdfBuffer,
      mimeType: "application/pdf",
      type: "pdf",
    });

    return {
      ...state,
      files: [file],
      aiResponse: `# PDF Generated

**${data.title}**

Your PDF is ready to download.`,
    };
  } catch (error) {
    throw toAgentError(error, "Failed to generate the PDF.");
  }
};
