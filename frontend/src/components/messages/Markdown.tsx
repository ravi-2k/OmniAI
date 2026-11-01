import { Children, isValidElement, useMemo, type ReactElement, type ReactNode } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { ExternalLink } from "lucide-react";

import type { Source } from "@/types/api";
import { CodeBlock } from "./CodeBlock";

// ---- citations: turn "[n]" into a link to source n (only when that source exists) ----
interface MdNode {
  type: string;
  value?: string;
  url?: string;
  children?: MdNode[];
}

const SKIP = new Set(["link", "linkReference", "code", "inlineCode", "definition"]);

const citationize = (node: MdNode, count: number) => {
  if (!node.children || SKIP.has(node.type)) return;

  const next: MdNode[] = [];
  for (const child of node.children) {
    if (child.type !== "text" || !child.value) {
      citationize(child, count);
      next.push(child);
      continue;
    }

    // Models cite as [1], but some (e.g. gpt-oss) use full-width 【1】 or 【1†source】.
    const pattern = /[[【](\d{1,2})(?:†[^\]】]*)?[\]】]/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let changed = false;
    while ((match = pattern.exec(child.value))) {
      const index = Number(match[1]);
      if (index < 1 || index > count) continue;
      changed = true;
      if (match.index > last) next.push({ type: "text", value: child.value.slice(last, match.index) });
      next.push({ type: "link", url: `#source-${index}`, children: [{ type: "text", value: String(index) }] });
      last = match.index + match[0].length;
    }
    if (!changed) {
      next.push(child);
    } else if (last < child.value.length) {
      next.push({ type: "text", value: child.value.slice(last) });
    }
  }
  node.children = next;
};

const remarkCitations = (count: number) => () => (tree: MdNode) => {
  if (count > 0) citationize(tree, count);
};

// ---- helpers ----
const textOf = (node: ReactNode): string => {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf((node.props as { children?: ReactNode }).children);
  return "";
};

interface MarkdownProps {
  content: string;
  sources?: Source[];
}

export default function Markdown({ content, sources = [] }: MarkdownProps) {
  const components = useMemo<Components>(
    () => ({
      a({ href = "", children }) {
        const citation = /^#source-(\d+)$/.exec(href);
        if (citation) {
          const source = sources[Number(citation[1]) - 1];
          if (!source) return <>{children}</>;
          return (
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              title={source.title}
              aria-label={`Source ${citation[1]}: ${source.title}`}
              className="mx-0.5 inline-flex size-[18px] -translate-y-px items-center justify-center rounded-full bg-accent-soft align-baseline text-[11px] font-semibold !text-accent !no-underline hover:bg-accent hover:!text-accent-fg"
            >
              {children}
            </a>
          );
        }

        const external = /^https?:\/\//i.test(href);
        return (
          <a href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {children}
            {external && <ExternalLink className="ml-0.5 inline size-3 -translate-y-px opacity-70" aria-label="(opens in a new tab)" />}
          </a>
        );
      },
      pre({ children }) {
        // rehype-highlight renders <pre><code class="hljs language-x">…</code></pre>
        const code = Children.toArray(children).find(isValidElement) as
          | ReactElement<{ className?: string; children?: ReactNode }>
          | undefined;
        const language = /language-([\w+#-]+)/.exec(code?.props.className ?? "")?.[1];
        return (
          <CodeBlock language={language} code={textOf(code?.props.children).replace(/\n$/, "")}>
            {children}
          </CodeBlock>
        );
      },
      table({ children }) {
        return (
          <div className="table-wrap">
            <table>{children}</table>
          </div>
        );
      },
      img({ src, alt }) {
        return <img src={src} alt={alt ?? ""} loading="lazy" referrerPolicy="no-referrer" />;
      },
    }),
    [sources],
  );

  return (
    <div className="prose-omni">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCitations(sources.length)]}
        rehypePlugins={[[rehypeHighlight, { detect: false, ignoreMissing: true }]]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
