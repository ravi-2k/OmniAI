import { getModel } from "../config/llmModels.js";
import { HttpError } from "../../../shared/http/errors.js";
import { textOf } from "../utils/llm.js";

const ROUTABLE = ["chat", "search", "coding", "pdf", "ppt", "vision"];

const isPdf = (file) => file?.mimetype === "application/pdf";
const isImage = (file) => file?.mimetype?.startsWith("image/");

// Resolves the agent for requests that carry a file, or validates the pairing
// the client asked for. Returns undefined when the file doesn't decide it.
const resolveWithFile = (agent, file) => {
  const auto = !agent || agent === "auto";

  // "pdf" and "vision" mean "work on my attachment" when one is attached.
  if ((auto || agent === "pdf" || agent === "pdfRag") && isPdf(file)) {
    return "pdfRag";
  }
  if ((auto || agent === "vision" || agent === "imageAnalyzer") && isImage(file)) {
    return "imageAnalyzer";
  }

  if (agent === "pdfRag" && !isPdf(file)) {
    throw new HttpError(400, "FILE_MISMATCH", "This agent needs a PDF file.");
  }
  if (agent === "imageAnalyzer" && !isImage(file)) {
    throw new HttpError(400, "FILE_MISMATCH", "This agent needs an image file.");
  }

  return undefined;
};

const classify = async (prompt) => {
  const llm = await getModel("router");
  const response = await llm.invoke(`You are an agent router.

Available agents:

- chat
- search
- coding
- pdf
- ppt
- vision

Rules:

chat:
General conversation,
explanations,
learning,
questions.

search:
Current events,
latest information,
news,
recent developments,
internet lookup.

coding:
Generate code,
debug code,
build projects,
architecture,
API design.

pdf:
Questions about generate PDFs
or document context.

ppt:
Questions about generate ppts
or ppt context.

vision:
  Generate image,
  create image

Return ONLY one word:

chat
search
coding
pdf
ppt
vision

User Query:
 ${prompt}
`);

  // Tolerate casing, punctuation or a short sentence around the answer.
  const answer = textOf(response).toLowerCase();
  return ROUTABLE.find((name) => new RegExp(`\\b${name}\\b`).test(answer)) || "chat";
};

export const router = async (state) => {
  const explicit = state.agent && state.agent !== "auto";

  if (state.file) {
    const resolved = resolveWithFile(state.agent, state.file);
    if (resolved) return { ...state, agent: resolved };
  }

  if (explicit) {
    return { ...state, agent: state.agent };
  }

  return { ...state, agent: await classify(state.prompt) };
};
