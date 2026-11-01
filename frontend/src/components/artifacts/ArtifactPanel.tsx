import { lazy, Suspense, useId, useState } from "react";
import { Check, Copy, Download, FileArchive, X } from "lucide-react";

import type { Artifact } from "@/types/api";
import { useToast } from "@/contexts/ToastContext";
import { copyText, downloadArtifactZip, downloadTextFile } from "@/utils/download";
import { isPreviewable } from "@/utils/preview";
import { cn } from "@/utils/cn";
import { IconButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";
import { FileTabs } from "./FileTabs";
import { PreviewFrame } from "./PreviewFrame";

// CodeMirror is only downloaded once someone actually opens an artifact.
const CodeViewer = lazy(() => import("./CodeViewer"));

type View = "code" | "preview";

interface ArtifactPanelProps {
  artifact: Artifact;
  onClose: () => void;
}

export default function ArtifactPanel({ artifact, onClose }: ArtifactPanelProps) {
  const toast = useToast();
  const panelId = useId();
  const previewable = isPreviewable(artifact);

  const [active, setActive] = useState(0);
  const [view, setView] = useState<View>(previewable ? "preview" : "code");
  const [copied, setCopied] = useState(false);
  const [zipping, setZipping] = useState(false);

  const file = artifact.files[Math.min(active, artifact.files.length - 1)];

  const copy = async () => {
    if (!file) return;
    if (await copyText(file.content)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access.", variant: "error" });
    }
  };

  const zip = async () => {
    setZipping(true);
    try {
      await downloadArtifactZip(artifact);
    } catch {
      toast({ title: "Couldn't create the ZIP", variant: "error" });
    } finally {
      setZipping(false);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-col">
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-3">
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-sm font-semibold text-fg" title={artifact.title}>
            {artifact.title || "Generated project"}
          </h2>
          <p className="text-xs text-fg-muted">
            {artifact.files.length} {artifact.files.length === 1 ? "file" : "files"}
          </p>
        </div>

        {previewable && (
          <div role="tablist" aria-label="View" className="flex rounded-lg bg-surface-2 p-0.5">
            {(
              [
                ["preview", "Preview"],
                ["code", "Code"],
              ] as const
            ).map(([option, label]) => (
              <button
                key={option}
                type="button"
                role="tab"
                aria-selected={view === option}
                onClick={() => setView(option)}
                className={cn(
                  "rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
                  view === option ? "bg-surface text-fg shadow-sm" : "text-fg-muted hover:text-fg",
                )}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        <IconButton label="Download all as ZIP" onClick={() => void zip()} disabled={zipping}>
          <FileArchive className="size-4" />
        </IconButton>
        <IconButton label="Close panel" onClick={onClose}>
          <X className="size-4" />
        </IconButton>
      </div>

      {view === "code" && (
        <>
          <div className="shrink-0 border-b border-border bg-surface-2/50">
            <FileTabs files={artifact.files} active={active} onSelect={setActive} panelId={panelId} />
          </div>
          <div className="flex shrink-0 items-center justify-between border-b border-border px-3 py-1">
            <span className="truncate font-mono text-xs text-fg-muted" title={file?.name}>
              {file?.name}
            </span>
            <div className="flex gap-0.5">
              <IconButton label={copied ? "Copied" : "Copy file"} size="sm" onClick={() => void copy()}>
                {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
              </IconButton>
              <IconButton
                label="Download file"
                size="sm"
                onClick={() => file && downloadTextFile(file.name, file.content)}
              >
                <Download className="size-4" />
              </IconButton>
            </div>
          </div>
        </>
      )}

      <div
        id={`${panelId}-panel`}
        role={view === "code" ? "tabpanel" : undefined}
        aria-labelledby={view === "code" ? `${panelId}-tab-${active}` : undefined}
        className="min-h-0 flex-1"
      >
        {view === "preview" && previewable ? (
          <PreviewFrame artifact={artifact} />
        ) : file ? (
          <Suspense fallback={<Skeleton className="m-4 h-40" />}>
            <CodeViewer name={file.name} content={file.content} language={file.language} />
          </Suspense>
        ) : (
          <p className="p-6 text-sm text-fg-muted">This project has no files.</p>
        )}
      </div>
    </div>
  );
}
