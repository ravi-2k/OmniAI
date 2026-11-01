import type { CSSProperties } from "react";
import { motion } from "motion/react";

import { SUGGESTIONS } from "@/config/agents";
import type { AgentId } from "@/config/agents";
import { LogoMark } from "@/components/ui/Logo";

interface EmptyStateProps {
  onPick: (prompt: string, agent: AgentId) => void;
}

// One hue per suggestion; the card derives its gradient, border and glow from it.
const TINTS = ["#d9a066", "#c47f5a", "#c9786f", "#a584c0", "#6fb3a8", "#9bb86a"];

/** Four-point star, the same motif as the cards' decoration. */
function Sparkle({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} style={style} aria-hidden>
      <path d="M12 0c.6 7.4 4.6 11.4 12 12-7.4.6-11.4 4.6-12 12-.6-7.4-4.6-11.4-12-12C7.4 11.4 11.4 7.4 12 0Z" />
    </svg>
  );
}

export function EmptyState({ onPick }: EmptyStateProps) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-4xl flex-col items-center justify-center px-5 py-4 sm:px-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        className="flex flex-col items-center text-center"
      >
        <LogoMark className="size-10" />
        <h1 className="gradient-text mt-3 text-balance pb-1 text-2xl font-semibold tracking-tight sm:text-[2.1rem] sm:leading-tight">
          What would you like to create today?
        </h1>
        <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-fg-muted">
          OmniAI brings specialised agents together: chat, live web search, code, PDFs, presentations and image
          understanding, all in one conversation.
        </p>
      </motion.div>

      <ul className="mt-6 grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SUGGESTIONS.map((suggestion, index) => {
          const Icon = suggestion.icon;
          const tint = TINTS[index % TINTS.length]!;
          return (
            <motion.li
              key={suggestion.title}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: 0.1 + index * 0.05 }}
            >
              <button
                type="button"
                onClick={() => onPick(suggestion.prompt, suggestion.agent)}
                style={{ "--tint": tint } as CSSProperties}
                className="tint-card group flex h-full min-h-[6.25rem] w-full flex-col items-start gap-1 rounded-2xl p-3.5 text-left"
              >
                <Sparkle className="sparkle right-5 top-4 size-4" />
                <Sparkle className="sparkle right-11 top-9 size-2.5" />
                <Sparkle className="sparkle right-3.5 top-[3.25rem] size-4" />
                <span
                  className="flex size-8 items-center justify-center rounded-lg"
                  style={{ color: tint, background: `color-mix(in oklab, ${tint} 16%, transparent)` }}
                >
                  <Icon className="size-4" aria-hidden />
                </span>
                <span className="mt-auto pt-1 text-[15px] font-semibold tracking-tight text-fg">{suggestion.title}</span>
                <span className="line-clamp-1 text-xs leading-snug text-fg-muted">{suggestion.prompt}</span>
              </button>
            </motion.li>
          );
        })}
      </ul>
    </div>
  );
}
