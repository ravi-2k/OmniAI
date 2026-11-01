import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Laptop, RefreshCw, Smartphone, Tablet } from "lucide-react";

import type { Artifact } from "@/types/api";
import { buildPreviewDoc, PREVIEW_ERROR_MESSAGE } from "@/utils/preview";
import { cn } from "@/utils/cn";
import { IconButton } from "@/components/ui/Button";

const DEVICES = [
  { id: "desktop", label: "Desktop width", icon: Laptop, width: "100%" },
  { id: "tablet", label: "Tablet width", icon: Tablet, width: "768px" },
  { id: "mobile", label: "Mobile width", icon: Smartphone, width: "390px" },
] as const;

/**
 * Renders generated HTML in a sandboxed iframe: scripts may run, but the document has
 * an opaque origin (no access to this app's cookies, storage or DOM), and the CSP
 * injected by buildPreviewDoc blocks network requests and navigation.
 */
export function PreviewFrame({ artifact }: { artifact: Artifact }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [version, setVersion] = useState(0);
  const [device, setDevice] = useState<(typeof DEVICES)[number]["id"]>("desktop");
  const [reported, setReported] = useState<{ run: string; message: string } | null>(null);
  const run = `${artifact.id}-${version}`;
  const runtimeError = reported?.run === run ? reported.message : null;

  const built = useMemo(() => {
    try {
      return { doc: buildPreviewDoc(artifact), failed: false };
    } catch {
      return { doc: null, failed: true };
    }
    // `version` forces a rebuild on refresh.
  }, [artifact, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Errors thrown by the generated page are reported by a small script injected into it.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const data = event.data as { type?: string; message?: string } | null;
      if (data?.type === PREVIEW_ERROR_MESSAGE) {
        setReported({ run, message: String(data.message ?? "Unknown error").slice(0, 300) });
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [run]);

  const width = DEVICES.find((entry) => entry.id === device)?.width ?? "100%";

  if (built.failed || !built.doc) {
    return (
      <div role="alert" className="flex h-full flex-col items-center justify-center gap-2 p-8 text-center">
        <AlertTriangle className="size-6 text-warning" aria-hidden />
        <p className="text-sm font-medium text-fg">This project can't be previewed</p>
        <p className="max-w-xs text-sm text-fg-muted">
          There's no HTML page to render, or it couldn't be read. You can still view and download the code.
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <div className="flex gap-0.5" role="group" aria-label="Preview size">
          {DEVICES.map(({ id, label, icon: Icon }) => (
            <IconButton
              key={id}
              label={label}
              size="sm"
              aria-pressed={device === id}
              onClick={() => setDevice(id)}
              className={cn(device === id && "bg-surface-3 text-fg")}
            >
              <Icon className="size-4" />
            </IconButton>
          ))}
        </div>
        <IconButton label="Refresh preview" size="sm" onClick={() => setVersion((current) => current + 1)}>
          <RefreshCw className="size-4" />
        </IconButton>
      </div>

      {runtimeError && (
        <div role="alert" className="flex items-start gap-2 border-b border-warning/30 bg-warning/10 px-3 py-2 text-xs text-fg">
          <AlertTriangle className="mt-px size-3.5 shrink-0 text-warning" aria-hidden />
          <span className="min-w-0 break-words">The page reported an error: {runtimeError}</span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 justify-center overflow-auto bg-surface-2 p-0">
        <iframe
          key={version}
          ref={frame}
          title={`Preview of ${artifact.title}`}
          sandbox="allow-scripts"
          srcDoc={built.doc}
          referrerPolicy="no-referrer"
          style={{ width }}
          className="h-full max-w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
