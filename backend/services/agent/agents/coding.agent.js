import { checkAgentLimit } from "../config/agentLimit.js";
import { getModel } from "../config/llmModels.js";
import { HttpError } from "../../../shared/http/errors.js";
import { toAgentError } from "../utils/agentErrors.js";
import {
  languageFromFilename,
  parseJsonFromLlm,
  shortTitle,
  str,
  textOf,
} from "../utils/llm.js";

const MAX_FILES = 30;
const MAX_FILE_CHARS = 500000;

// Keep generated paths relative and free of traversal segments.
const cleanFileName = (name) =>
  str(name)
    .replace(/\\/g, "/")
    .split("/")
    .filter((part) => part && part !== "." && part !== "..")
    .join("/");

const buildArtifact = (data, prompt) => {
  const files = (Array.isArray(data?.files) ? data.files : [])
    .slice(0, MAX_FILES)
    .map((file) => ({
      name: cleanFileName(file?.name),
      content: typeof file?.content === "string" ? file.content : "",
    }))
    .filter((file) => file.name && file.content.length <= MAX_FILE_CHARS)
    .map((file) => ({ ...file, language: languageFromFilename(file.name) }));

  if (!files.length) {
    throw new HttpError(
      502,
      "BAD_AI_RESPONSE",
      "The AI did not produce any files. Please try again.",
    );
  }

  const entry =
    files.find((file) => file.name === "index.html") ||
    files.find((file) => file.language === "html") ||
    files[0];

  return {
    id: Date.now(),
    type: "Project",
    title: shortTitle(prompt),
    entry: entry.name,
    files,
  };
};

export const codingAgent = async (state) => {
  try {
    await checkAgentLimit(state.userId, "coding");
    const intentLlm = await getModel("intent");
    const llm = await getModel("coding");
    const intentRes = await intentLlm.invoke(`
      You are an intent classifier.

      Return ONLY one of these values.

      CODE_GENERATION
      CODE_REVIEW
      CODE_EXPLANATION
      DEBUGGING
      OPTIMIZATION
      CONVERSION
      DOCUMENTATION

      User Request:
      ${state.prompt}
    `);
    // Tolerate whitespace, casing or quotes around the label.
    const intent = textOf(intentRes).trim().toUpperCase().replace(/[^A-Z_]/g, "");

    if (intent.includes("CODE_GENERATION")) {
      const prompt = `
        You are OmniAI Coding Agent.

        Generate the requested project.

        Default stack:
        - HTML
        - CSS
        - JavaScript

        Use React / Next.js / Vue ONLY if explicitly requested.

        Rules:

        - Responsive
        - Modern UI
        - CSS Variables
        - Flexbox/Grid
        - Smooth Scroll
        - Hover Effects
        - Beautiful spacing
        - Single page unless user asks otherwise.

        IMAGES
        =========================

        Always use real Unsplash images.

        Never use placeholders.

        Return ONLY valid JSON.

        Schema:

        {
          "files":[
            {
              "name":"index.html",
              "content":"..."
            },
            {
              "name":"style.css",
              "content":"..."
            },
            {
              "name":"script.js",
              "content":"..."
            }
          ]
        }

        Rules:

        - Output must start with {
        - Output must end with }
        - No markdown
        - No explanation
        - No extra text
        - No \`\`\`
        - Never mention intent

        User Request:
        ${state.prompt}
      `;
      const res = await llm.invoke(prompt);
      const data = parseJsonFromLlm(textOf(res));

      return {
        ...state,
        aiResponse: "Code Generated Successfully.",
        artifacts: [buildArtifact(data, state.prompt)],
      };
    }

    const res = await llm.invoke(`
      The user's request is:

      ${intent}

      Return Markdown only.

      Never generate project files.

      Use headings like:

      # Overview

      ## Explanation

      ## Problems

      ## Improvements

      ## Best Practices

      ## Optimized Code (if needed)

      User Request:

      ${state.prompt}
    `);

    return {
      ...state,
      aiResponse: textOf(res),
      artifacts: [],
    };
  } catch (error) {
    throw toAgentError(error, "Failed to generate code.");
  }
};
