import { ChevronRight, FolderCode } from "lucide-react";

import type { Artifact } from "@/types/api";
import { useArtifacts } from "@/contexts/ArtifactContext";

/** Entry shown in the conversation for generated code; opens the Artifacts panel. */
export function ArtifactCard({ artifact, conversationId }: { artifact: Artifact; conversationId: string }) {
  const { openArtifact } = useArtifacts();
  const count = artifact.files?.length ?? 0;

  if (!count) {
    return (
      <div role="alert" className="rounded-xl border border-dashed border-border-strong p-3 text-sm text-fg-muted">
        This project has no readable files.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => openArtifact(conversationId, artifact)}
      className="group flex w-full max-w-md items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left shadow-card transition-all hover:-translate-y-0.5 hover:border-accent/50"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
        <FolderCode className="size-5" aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-fg">{artifact.title || "Generated project"}</span>
        <span className="block text-xs text-fg-muted">
          {count} {count === 1 ? "file" : "files"} · Open in panel
        </span>
      </span>
      <ChevronRight className="size-4 text-fg-subtle transition-transform group-hover:translate-x-0.5" aria-hidden />
    </button>
  );
}
