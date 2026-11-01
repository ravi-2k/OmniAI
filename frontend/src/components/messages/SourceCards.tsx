import { ExternalLink } from "lucide-react";

import type { Source } from "@/types/api";

const domainOf = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
};

const isHttp = (url: string) => /^https?:\/\//i.test(url);

/** Source attribution for Search answers. Numbers match the [n] citations in the text. */
export function SourceCards({ sources }: { sources: Source[] }) {
  const usable = sources.filter((source) => isHttp(source.url));
  if (!usable.length) return null;

  return (
    <section aria-label="Sources" className="mt-5">
      <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-fg-subtle">Sources</h4>
      <ol className="grid gap-2 sm:grid-cols-2">
        {usable.map((source, index) => (
          <li key={`${source.url}-${index}`}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex h-full gap-3 rounded-2xl border border-border bg-surface p-3.5 shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/50"
            >
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent">
                {index + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-2 text-sm font-medium text-fg">{source.title || domainOf(source.url)}</span>
                <span className="mt-0.5 flex items-center gap-1 text-xs text-fg-muted">
                  {domainOf(source.url)}
                  <ExternalLink className="size-3 opacity-0 transition-opacity group-hover:opacity-70" aria-hidden />
                </span>
                {source.snippet && (
                  <span className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-fg-muted">{source.snippet}</span>
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}
