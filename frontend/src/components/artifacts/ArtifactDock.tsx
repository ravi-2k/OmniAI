import { lazy, Suspense, useCallback, useEffect, useState, type KeyboardEvent, type PointerEvent } from "react";
import { AnimatePresence, motion } from "motion/react";

import type { Artifact } from "@/types/api";
import { MIN_PANEL_WIDTH, useArtifacts } from "@/contexts/ArtifactContext";
import { useIsMobile } from "@/hooks/utility";
import { Skeleton } from "@/components/ui/Feedback";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";

const ArtifactPanel = lazy(() => import("./ArtifactPanel"));

interface ArtifactDockProps {
  conversationId: string;
  artifact: Artifact | undefined;
  open: boolean;
}

/** Places the panel: a resizable right column on desktop, a full-screen sheet on mobile. */
export function ArtifactDock({ conversationId, artifact, open }: ArtifactDockProps) {
  const { closePanel, width, setWidth } = useArtifacts();
  const isMobile = useIsMobile();
  const [dragging, setDragging] = useState(false);

  const close = useCallback(() => closePanel(conversationId), [closePanel, conversationId]);

  // Escape closes the full-screen sheet on mobile.
  useEffect(() => {
    if (!open || !isMobile) return;
    const onKey = (event: globalThis.KeyboardEvent) => event.key === "Escape" && close();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, isMobile, close]);

  const clamp = (value: number) => Math.min(Math.max(value, MIN_PANEL_WIDTH), Math.min(960, window.innerWidth * 0.7));

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (dragging) setWidth(clamp(window.innerWidth - event.clientX));
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") setWidth(clamp(width + 24));
    if (event.key === "ArrowRight") setWidth(clamp(width - 24));
  };

  const content = artifact && (
    <ErrorBoundary
      fallback={
        <div role="alert" className="p-6 text-sm text-fg-muted">
          The artifact panel hit a problem. Close it and try again; your chat is unaffected.
        </div>
      }
    >
      <Suspense fallback={<Skeleton className="m-4 h-64" />}>
        <ArtifactPanel key={artifact.id} artifact={artifact} onClose={close} />
      </Suspense>
    </ErrorBoundary>
  );

  if (isMobile) {
    return (
      <AnimatePresence>
        {open && artifact && (
          <motion.aside
            aria-label="Artifacts"
            className="glass fixed inset-0 z-40"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 420, damping: 42 }}
          >
            {content}
          </motion.aside>
        )}
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence initial={false}>
      {open && artifact && (
        <motion.aside
          aria-label="Artifacts"
          className="glass-panel relative shrink-0 overflow-hidden rounded-3xl"
          initial={{ width: 0, marginLeft: 0, opacity: 0 }}
          animate={{ width: clamp(width), marginLeft: 12, opacity: 1 }}
          exit={{ width: 0, marginLeft: 0, opacity: 0 }}
          transition={dragging ? { duration: 0 } : { duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
        >
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize artifacts panel"
            aria-valuenow={Math.round(width)}
            aria-valuemin={MIN_PANEL_WIDTH}
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onKeyDown={onKeyDown}
            className="absolute inset-y-0 left-0 z-10 w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-accent/40 focus-visible:bg-accent/60"
          />
          <div className="h-full" style={{ width: clamp(width) }}>
            {content}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
