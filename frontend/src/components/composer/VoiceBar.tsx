import { Check, X } from "lucide-react";

import { Button } from "@/components/ui/Button";

const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

/** Shown while recording: status, timer, and the cancel / done controls. */
export function VoiceBar({
  elapsed,
  onCancel,
  onDone,
}: {
  elapsed: number;
  onCancel: () => void;
  onDone: () => void;
}) {
  return (
    <div
      className="mb-2 flex items-center gap-3 rounded-xl border border-danger/30 bg-danger-soft px-3 py-2"
      role="status"
    >
      <span className="rec-dot" aria-hidden />
      <span className="text-sm font-medium text-fg">Listening…</span>
      <span className="font-mono text-sm tabular-nums text-fg-muted" aria-label={`Recording for ${elapsed} seconds`}>
        {clock(elapsed)}
      </span>
      <span className="flex-1" />
      <Button size="sm" variant="ghost" onClick={onCancel} aria-label="Cancel recording">
        <X className="size-3.5" /> Cancel
      </Button>
      <Button size="sm" variant="primary" onClick={onDone} aria-label="Finish recording">
        <Check className="size-3.5" /> Done
      </Button>
    </div>
  );
}
