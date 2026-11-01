import { useEffect, useState } from "react";
import { AlertCircle, FileText, RotateCcw, Square, X } from "lucide-react";

import { WORKING_LABELS } from "@/config/agents";
import type { Message } from "@/types/api";
import { userMessage } from "@/services/api/errors";
import { useChatSession, type PendingSend } from "@/contexts/ChatSessionContext";
import { formatBytes } from "@/utils/files";
import { Button } from "@/components/ui/Button";
import { RippleLoader } from "@/components/ui/Feedback";
import { AssistantMessage } from "./AssistantMessage";
import { UserMessage } from "./UserMessage";

const useNow = (active: boolean) => {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
};

function LocalAttachment({ item }: { item: PendingSend }) {
  if (!item.file) return null;
  const uploading = item.status === "working" && item.progress !== null;

  return (
    <div className="inline-flex max-w-full flex-col gap-1.5 rounded-xl border border-border bg-surface p-2">
      <div className="flex items-center gap-2.5">
        {item.previewUrl ? (
          <img src={item.previewUrl} alt="" className="size-14 rounded-lg object-cover" />
        ) : (
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent-soft text-accent">
            <FileText className="size-5" aria-hidden />
          </span>
        )}
        <div className="min-w-0">
          <p className="max-w-48 truncate text-sm text-fg">{item.file.name}</p>
          <p className="text-xs text-fg-muted">
            {uploading ? `Uploading… ${item.progress}%` : formatBytes(item.file.size)}
          </p>
        </div>
      </div>
      {uploading && (
        <div
          className="h-1 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-label="Upload progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={item.progress ?? 0}
        >
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${item.progress}%` }} />
        </div>
      )}
    </div>
  );
}

/** Starts on the agent's own status line, then cycles the rest in a random order. */
const useRotatingLabel = (agent: PendingSend["agent"]) => {
  const [labels] = useState(() => {
    const [first = "Thinking…", ...rest] = WORKING_LABELS[agent] ?? WORKING_LABELS.auto;
    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j]!, rest[i]!];
    }
    return [first, ...rest];
  });
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = window.setInterval(() => setIndex((current) => current + 1), 2800);
    return () => window.clearInterval(timer);
  }, []);
  return labels[index % labels.length]!;
};

function Working({ item, onCancel }: { item: PendingSend; onCancel: () => void }) {
  const now = useNow(true);
  const seconds = Math.max(0, Math.floor((now - item.startedAt) / 1000));
  const rotating = useRotatingLabel(item.agent);
  const status = item.progress !== null ? "Uploading your file…" : rotating;

  return (
    <div className="flex flex-wrap items-center gap-3 py-1" role="status">
      <RippleLoader />
      <span className="text-sm font-medium text-fg-muted">
        <span key={status} className="label-swap shimmer-text">
          {status}
        </span>
        {seconds >= 10 && <span className="text-fg-subtle"> · {seconds}s</span>}
      </span>
      <Button size="sm" variant="ghost" onClick={onCancel} aria-label="Stop generating">
        <Square className="size-3 fill-current" /> Stop
      </Button>
    </div>
  );
}

function Failed({ item, onRetry, onDismiss }: { item: PendingSend; onRetry: () => void; onDismiss: () => void }) {
  // Rate limits tell us how long to wait; keep Retry disabled until then.
  const [until] = useState(() =>
    item.error?.code === "RATE_LIMITED" && item.error.remainingTime
      ? Date.now() + item.error.remainingTime * 1000
      : 0,
  );
  const now = useNow(until > 0);
  const wait = Math.max(0, Math.ceil((until - now) / 1000));

  return (
    <div role="alert" className="rounded-xl border border-danger/30 bg-danger-soft p-3.5">
      <div className="flex items-start gap-2.5">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
        <p className="text-sm text-fg">{userMessage(item.error)}</p>
      </div>
      <div className="mt-3 flex gap-2 pl-6">
        <Button size="sm" variant="secondary" onClick={onRetry} disabled={wait > 0}>
          <RotateCcw className="size-3.5" /> {wait > 0 ? `Retry in ${wait}s` : "Retry"}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDismiss}>
          <X className="size-3.5" /> Dismiss
        </Button>
      </div>
    </div>
  );
}

/** The optimistic user bubble plus the assistant's in-progress or failed state. */
export function PendingExchange({ item }: { item: PendingSend }) {
  const { cancel, retry, dismiss } = useChatSession();

  const placeholder: Message = {
    _id: item.id,
    conversationId: item.conversationId,
    role: "assistant",
    content: "",
    createdAt: item.createdAt,
  };

  return (
    <>
      <UserMessage
        content={item.prompt}
        localAttachment={item.file ? <LocalAttachment item={item} /> : undefined}
      />
      <AssistantMessage message={placeholder}>
        {item.status === "working" ? (
          <Working item={item} onCancel={() => cancel(item.id)} />
        ) : (
          <Failed item={item} onRetry={() => retry(item.id)} onDismiss={() => dismiss(item.id)} />
        )}
      </AssistantMessage>
    </>
  );
}
