import { memo, useState, type ReactNode } from "react";

import type { Message } from "@/types/api";
import { LogoMark } from "@/components/ui/Logo";
import { AgentBadge } from "./AgentBadge";
import { ArtifactCard } from "./ArtifactCard";
import { FileCard } from "./FileCard";
import { MarkdownContent } from "./MarkdownContent";
import { MessageActions } from "./MessageActions";
import { SourceCards } from "./SourceCards";

const isHttp = (url: string) => /^https?:\/\//i.test(url);

/** Web images returned by Search. External, so they're linked rather than proxied. */
function ImageStrip({ images }: { images: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const visible = images.filter((url) => isHttp(url) && !hidden.has(url)).slice(0, 8);
  if (!visible.length) return null;

  return (
    <div className="mt-4 flex gap-2 overflow-x-auto pb-1" aria-label="Related images">
      {visible.map((url) => (
        <a
          key={url}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 overflow-hidden rounded-xl border border-border bg-surface-2"
        >
          <img
            src={url}
            alt="Related image from search results"
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-28 w-auto object-cover"
            onError={() => setHidden((current) => new Set(current).add(url))}
          />
        </a>
      ))}
    </div>
  );
}

interface AssistantMessageProps {
  message: Message;
  /** Replaces the default body (used for pending / error states). */
  children?: ReactNode;
}

export const AssistantMessage = memo(function AssistantMessage({ message, children }: AssistantMessageProps) {
  const sources = message.sources ?? [];
  const files = message.files ?? [];
  const artifacts = message.artifacts ?? [];
  const images = message.images ?? [];

  return (
    <article className="flex gap-3.5" aria-label="Assistant response">
      <LogoMark className="mt-0.5 size-7 shrink-0" />
      <div className="min-w-0 flex-1">
        <div className="mb-1.5 flex items-center gap-2">
          <span className="text-sm font-semibold text-fg">OmniAI</span>
          <AgentBadge agent={message.agent} />
        </div>

        {children ?? (
          <>
            {message.content && <MarkdownContent content={message.content} sources={sources} />}

            {files.length > 0 && (
              <div className="mt-3 flex flex-col items-start gap-2.5">
                {files.map((file) => (
                  <FileCard key={file.key} file={file} />
                ))}
              </div>
            )}

            {artifacts.length > 0 && (
              <div className="mt-3 flex flex-col items-start gap-2.5">
                {artifacts.map((artifact) => (
                  <ArtifactCard key={artifact.id} artifact={artifact} conversationId={message.conversationId} />
                ))}
              </div>
            )}

            <ImageStrip images={images} />
            <SourceCards sources={sources} />
            <MessageActions message={message} />
          </>
        )}
      </div>
    </article>
  );
});
