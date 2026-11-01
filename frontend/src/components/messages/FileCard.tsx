import { useState } from "react";
import { Download, Eye, FileText, Loader2, Presentation } from "lucide-react";

import type { GeneratedFile, StoredFile } from "@/types/api";
import { useFileUrl } from "@/hooks/useFileUrl";
import { useToast } from "@/contexts/ToastContext";
import { openUrl } from "@/utils/download";
import { formatBytes, isImage } from "@/utils/files";
import { Button } from "@/components/ui/Button";
import { ImageThumb } from "./ImageViewer";

const TYPE_LABELS: Record<string, string> = {
  pdf: "PDF document",
  ppt: "PowerPoint presentation",
  image: "Image",
};

/** A downloadable generated file (PDF, PPTX) or an inline image. */
export function FileCard({ file }: { file: GeneratedFile }) {
  if (file.type === "image" || isImage(file.mimeType)) return <ImageThumb file={file} />;
  return <DocumentCard file={file} />;
}

function DocumentCard({ file }: { file: GeneratedFile }) {
  const toast = useToast();
  const { ensureFresh } = useFileUrl(file);
  const [busy, setBusy] = useState<"download" | "preview" | null>(null);

  const run = async (kind: "download" | "preview") => {
    setBusy(kind);
    try {
      const signed = await ensureFresh();
      if (kind === "download") openUrl(signed.downloadUrl, false);
      else openUrl(signed.url, true);
    } catch {
      toast({
        title: "Couldn't get the file",
        description: "The download link could not be refreshed. Please try again.",
        variant: "error",
      });
    } finally {
      setBusy(null);
    }
  };

  const Icon = file.type === "ppt" ? Presentation : FileText;
  const canPreview = file.type === "pdf";

  return (
    <div className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 shadow-card">
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-fg" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-fg-muted">
          {[TYPE_LABELS[file.type ?? ""] ?? "File", formatBytes(file.size)].filter(Boolean).join(" · ")}
        </p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {canPreview && (
          <Button size="sm" onClick={() => void run("preview")} disabled={busy !== null} aria-label={`Preview ${file.name}`}>
            {busy === "preview" ? <Loader2 className="size-3.5 animate-spin" /> : <Eye className="size-3.5" />}
            <span className="max-sm:sr-only">Preview</span>
          </Button>
        )}
        <Button
          size="sm"
          variant="primary"
          onClick={() => void run("download")}
          disabled={busy !== null}
          aria-label={`Download ${file.name}`}
        >
          {busy === "download" ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
          <span className="max-sm:sr-only">Download</span>
        </Button>
      </div>
    </div>
  );
}

/** Compact chip for a user's own attachment (PDF or image). */
export function AttachmentView({ file }: { file: StoredFile }) {
  if (isImage(file.mimeType)) return <ImageThumb file={file} small />;

  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2">
      <FileText className="size-4 shrink-0 text-accent" aria-hidden />
      <span className="truncate text-sm text-fg" title={file.name}>
        {file.name}
      </span>
      {file.size !== undefined && <span className="shrink-0 text-xs text-fg-muted">{formatBytes(file.size)}</span>}
    </div>
  );
}
