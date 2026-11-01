import { useEffect, useState } from "react";
import { FileText, X } from "lucide-react";

import { formatBytes, isImage } from "@/utils/files";

/** A file queued for sending, with a thumbnail for images and a remove button. */
export function AttachmentChip({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [preview, setPreview] = useState<string>();

  useEffect(() => {
    if (!isImage(file.type)) return;
    const url = URL.createObjectURL(file);
    // Creating an object URL is external-resource sync; it must be revoked on cleanup.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="inline-flex max-w-full items-center gap-2.5 rounded-2xl border border-border bg-surface-2 py-1.5 pl-1.5 pr-2">
      {preview ? (
        <img src={preview} alt="" className="size-10 rounded-lg object-cover" />
      ) : (
        <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
          <FileText className="size-5" aria-hidden />
        </span>
      )}
      <div className="min-w-0">
        <p className="max-w-44 truncate text-sm text-fg" title={file.name}>
          {file.name}
        </p>
        <p className="text-xs text-fg-muted">{formatBytes(file.size)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.name}`}
        className="ml-1 rounded-md p-1 text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
