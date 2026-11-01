import { lazy, Suspense } from "react";

import type { Source } from "@/types/api";

// The Markdown renderer and syntax highlighter are loaded on demand to keep the
// initial bundle small.
const Markdown = lazy(() => import("./Markdown"));

export function MarkdownContent({ content, sources }: { content: string; sources?: Source[] }) {
  return (
    <Suspense fallback={<div className="prose-omni whitespace-pre-wrap">{content}</div>}>
      <Markdown content={content} sources={sources} />
    </Suspense>
  );
}
