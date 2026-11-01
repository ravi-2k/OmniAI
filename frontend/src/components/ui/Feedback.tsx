import { Loader2 } from "lucide-react";

import { cn } from "@/utils/cn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden />;
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton", className)} aria-hidden />;
}

/** Rings rippling out from a glowing core; used while an agent works. */
export function RippleLoader() {
  return (
    <span className="ripple" aria-hidden>
      <i />
      <i />
      <i />
      <b />
    </span>
  );
}

export function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="typing-dot" />
      <span className="typing-dot" />
      <span className="typing-dot" />
    </span>
  );
}
