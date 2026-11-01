import {
  Code2,
  FileText,
  Globe,
  ImageIcon,
  MessageSquare,
  Presentation,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

import type { BackendAgent } from "@/types/api";

export type AgentId = "auto" | "chat" | "search" | "pdf" | "ppt" | "coding" | "vision";

export type FileAccept = "none" | "pdf" | "image" | "pdf-or-image";

export interface AgentDef {
  id: AgentId;
  label: string;
  description: string;
  icon: LucideIcon;
  placeholder: string;
  /** What kind of attachment this agent can use. */
  accepts: FileAccept;
  /** Status line while waiting for the backend. */
  working: string;
}

export const AGENTS: AgentDef[] = [
  {
    id: "auto",
    label: "Auto",
    description: "Picks the best agent for your request.",
    icon: Sparkles,
    placeholder: "Ask anything, or attach a PDF or image…",
    accepts: "pdf-or-image",
    working: "Thinking…",
  },
  {
    id: "chat",
    label: "Chat",
    description: "General conversation and explanations.",
    icon: MessageSquare,
    placeholder: "Ask a question or start a conversation…",
    accepts: "none",
    working: "Thinking…",
  },
  {
    id: "search",
    label: "Search",
    description: "Searches the web and cites sources.",
    icon: Globe,
    placeholder: "What do you want to look up?",
    accepts: "none",
    working: "Searching the web…",
  },
  {
    id: "pdf",
    label: "PDF",
    description: "Creates a PDF, or answers questions about one you attach.",
    icon: FileText,
    placeholder: "Describe the PDF to create, or attach one to ask about…",
    accepts: "pdf",
    working: "Working on your PDF…",
  },
  {
    id: "ppt",
    label: "PPT",
    description: "Builds a PowerPoint presentation.",
    icon: Presentation,
    placeholder: "What should the presentation cover?",
    accepts: "none",
    working: "Building your presentation…",
  },
  {
    id: "coding",
    label: "Coding",
    description: "Generates, explains, debugs and refactors code.",
    icon: Code2,
    placeholder: "Describe what to build, or paste code to review…",
    accepts: "none",
    working: "Writing code…",
  },
  {
    id: "vision",
    label: "Vision",
    description: "Generates images, or analyses one you attach.",
    icon: ImageIcon,
    placeholder: "Describe an image to create, or attach one to analyse…",
    accepts: "image",
    working: "Working on your image…",
  },
];

export const getAgent = (id: AgentId): AgentDef =>
  AGENTS.find((agent) => agent.id === id) ?? AGENTS[0]!;

/** Labels for any agent value the backend may report in a response. */
const BACKEND_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  chat: { label: "Chat", icon: MessageSquare },
  search: { label: "Search", icon: Globe },
  coding: { label: "Coding", icon: Code2 },
  pdf: { label: "PDF", icon: FileText },
  pdfRag: { label: "PDF Q&A", icon: FileText },
  ppt: { label: "PPT", icon: Presentation },
  vision: { label: "Image", icon: ImageIcon },
  imageAnalyzer: { label: "Vision", icon: ImageIcon },
};

export const describeBackendAgent = (agent?: string) =>
  agent ? BACKEND_LABELS[agent] : undefined;

/**
 * Maps the UI choice to the value the backend expects.
 * The backend routes `pdf`/`vision` to document/image *analysis* when a file of the
 * matching type is attached, and to *generation* otherwise.
 */
export const toBackendAgent = (
  agent: AgentId,
  options: { hasFile: boolean; askAboutPdf: boolean },
): BackendAgent => {
  if (agent === "pdf" && !options.hasFile && options.askAboutPdf) return "pdfRag";
  return agent;
};

export const SUGGESTIONS: { title: string; prompt: string; agent: AgentId; icon: LucideIcon }[] = [
  {
    title: "Explain a concept",
    prompt: "Explain how transformers work in machine learning, with a simple analogy.",
    agent: "chat",
    icon: MessageSquare,
  },
  {
    title: "Search the latest",
    prompt: "What are the most important AI announcements this week?",
    agent: "search",
    icon: Globe,
  },
  {
    title: "Create a PDF report",
    prompt: "Create a PDF report on the benefits and risks of remote work.",
    agent: "pdf",
    icon: FileText,
  },
  {
    title: "Make a presentation",
    prompt: "Create a presentation introducing cloud computing for beginners.",
    agent: "ppt",
    icon: Presentation,
  },
  {
    title: "Build something",
    prompt: "Build a modern landing page for a coffee shop with a hero, menu and contact section.",
    agent: "coding",
    icon: Code2,
  },
  {
    title: "Analyse an image",
    prompt: "Describe what is in this image and read any text you can see.",
    agent: "vision",
    icon: ImageIcon,
  },
];

/** Status lines shown (in rotation) while an agent works. The first matches `AgentDef.working`. */
export const WORKING_LABELS: Record<AgentId, string[]> = {
  auto: ["Thinking…", "Reading your request…", "Picking the best agent…", "Connecting the dots…", "Weighing the options…", "Putting thoughts together…", "Almost there…"],
  chat: ["Thinking…", "Gathering my thoughts…", "Drafting a reply…", "Finding the right words…", "Double-checking the details…", "Polishing the answer…"],
  search: ["Searching the web…", "Reading sources…", "Cross-checking facts…", "Gathering the latest…", "Summarising findings…", "Lining up citations…"],
  pdf: ["Working on your PDF…", "Structuring the outline…", "Laying out the pages…", "Typesetting…", "Rendering the document…"],
  ppt: ["Building your presentation…", "Outlining the slides…", "Choosing a layout…", "Writing the talking points…", "Polishing the deck…"],
  coding: ["Writing code…", "Sketching the architecture…", "Wiring up components…", "Tidying the styles…", "Testing it in my head…", "Compiling ideas…"],
  vision: ["Working on your image…", "Looking closely…", "Studying the details…", "Mixing colours…", "Rendering pixels…"],
};
