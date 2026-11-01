import { useEffect, useRef } from "react";
import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, lineNumbers } from "@codemirror/view";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";

// Colours come from CSS variables, so the viewer follows the light/dark theme with no rebuild.
const highlightStyle = HighlightStyle.define([
  { tag: [t.keyword, t.modifier, t.operatorKeyword, t.controlKeyword], color: "var(--hl-keyword)" },
  { tag: [t.string, t.regexp, t.special(t.string)], color: "var(--hl-string)" },
  { tag: [t.number, t.bool, t.null, t.atom], color: "var(--hl-number)" },
  { tag: [t.comment, t.lineComment, t.blockComment], color: "var(--hl-comment)", fontStyle: "italic" },
  {
    tag: [t.function(t.variableName), t.function(t.propertyName), t.definition(t.function(t.variableName))],
    color: "var(--hl-function)",
  },
  { tag: [t.typeName, t.className, t.tagName, t.angleBracket], color: "var(--hl-type)" },
  { tag: [t.propertyName, t.attributeName], color: "var(--hl-function)" },
  { tag: [t.punctuation, t.operator, t.bracket], color: "var(--hl-punct)" },
  { tag: t.heading, fontWeight: "bold" },
]);

const theme = EditorView.theme({
  "&": { color: "var(--fg)", backgroundColor: "transparent", height: "100%" },
  ".cm-content": { caretColor: "var(--accent)", padding: "12px 0" },
  ".cm-gutters": { backgroundColor: "transparent", color: "var(--fg-subtle)", border: "none" },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 12px 0 16px", minWidth: "40px" },
  ".cm-line": { padding: "0 16px 0 4px" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { backgroundColor: "var(--accent-soft)" },
});

const LANGUAGES: Record<string, () => Promise<Extension>> = {
  html: async () => (await import("@codemirror/lang-html")).html(),
  css: async () => (await import("@codemirror/lang-css")).css(),
  scss: async () => (await import("@codemirror/lang-css")).css(),
  javascript: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true }),
  typescript: async () => (await import("@codemirror/lang-javascript")).javascript({ jsx: true, typescript: true }),
  json: async () => (await import("@codemirror/lang-json")).json(),
  markdown: async () => (await import("@codemirror/lang-markdown")).markdown(),
  python: async () => (await import("@codemirror/lang-python")).python(),
};

const baseExtensions = (label: string): Extension[] => [
  lineNumbers(),
  syntaxHighlighting(highlightStyle),
  theme,
  EditorView.lineWrapping,
  // Read-only, but selectable so people can copy parts of the code.
  EditorState.readOnly.of(true),
  EditorView.contentAttributes.of({ "aria-readonly": "true", "aria-label": label }),
];

interface CodeViewerProps {
  name: string;
  content: string;
  language?: string;
}

export default function CodeViewer({ name, content, language }: CodeViewerProps) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);

  useEffect(() => {
    if (!host.current) return;
    view.current = new EditorView({ parent: host.current, state: EditorState.create({ doc: "" }) });
    return () => {
      view.current?.destroy();
      view.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const editor = view.current;
    if (!editor) return;

    const label = `Source of ${name}`;
    const show = (extra: Extension[]) => {
      if (cancelled || !view.current) return;
      view.current.setState(EditorState.create({ doc: content, extensions: [...baseExtensions(label), ...extra] }));
    };

    // Show the text immediately, then add syntax support when it has loaded.
    show([]);
    const load = language ? LANGUAGES[language] : undefined;
    if (load) {
      load()
        .then((support) => show([support]))
        .catch(() => undefined);
    }

    return () => {
      cancelled = true;
    };
  }, [name, content, language]);

  return <div ref={host} className="h-full overflow-hidden" />;
}
