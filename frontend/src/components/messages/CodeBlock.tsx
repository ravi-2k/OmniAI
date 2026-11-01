import { useState, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";

import { copyText } from "@/utils/download";

interface CodeBlockProps {
  language?: string;
  /** Raw source text, used for copying. */
  code: string;
  /** Highlighted nodes from rehype-highlight. */
  children: ReactNode;
}

export function CodeBlock({ language, code, children }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    }
  };

  return (
    <div className="code-block group/code my-4 overflow-hidden rounded-2xl border border-border bg-surface-2 shadow-card">
      <div className="flex items-center justify-between border-b border-border bg-surface-3/60 px-3.5 py-1.5">
        <span className="font-mono text-xs text-fg-muted">{language || "text"}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg"
          aria-label={copied ? "Code copied" : "Copy code"}
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre tabIndex={0}>{children}</pre>
    </div>
  );
}
