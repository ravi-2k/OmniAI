import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import type { Message } from "@/types/api";
import type { PendingSend } from "@/contexts/ChatSessionContext";
import { userMessage } from "@/services/api/errors";
import { Button } from "@/components/ui/Button";
import { Skeleton, Spinner } from "@/components/ui/Feedback";
import { AssistantMessage } from "@/components/messages/AssistantMessage";
import { PendingExchange } from "@/components/messages/PendingExchange";
import { UserMessage } from "@/components/messages/UserMessage";

interface MessageListProps {
  conversationId: string;
  messages: Message[];
  pending: PendingSend[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  hasOlder: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
}

const NEAR_BOTTOM_PX = 140;

export function MessageList({
  conversationId,
  messages,
  pending,
  loading,
  error,
  onRetry,
  hasOlder,
  loadingOlder,
  onLoadOlder,
}: MessageListProps) {
  const scroller = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const heightBeforeOlder = useRef<number | null>(null);
  const [showJump, setShowJump] = useState(false);
  const firstPendingStatus = pending[0]?.status;

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "auto") => {
    const element = scroller.current;
    if (element) element.scrollTo({ top: element.scrollHeight, behavior });
  }, []);

  const onScroll = () => {
    const element = scroller.current;
    if (!element) return;
    const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
    stickToBottom.current = distance < NEAR_BOTTOM_PX;
    setShowJump(distance > 400);
  };

  // New conversation: start at the bottom.
  useEffect(() => {
    stickToBottom.current = true;
    scrollToBottom();
  }, [conversationId, scrollToBottom]);

  // Keep following the conversation as it grows, unless the user scrolled up.
  useLayoutEffect(() => {
    const element = scroller.current;
    if (!element) return;

    if (heightBeforeOlder.current !== null) {
      // Older messages were prepended: keep the reader's place.
      element.scrollTop += element.scrollHeight - heightBeforeOlder.current;
      heightBeforeOlder.current = null;
      return;
    }
    if (stickToBottom.current) scrollToBottom();
  }, [messages.length, pending.length, firstPendingStatus, loading, scrollToBottom]);

  const loadOlder = () => {
    heightBeforeOlder.current = scroller.current?.scrollHeight ?? null;
    onLoadOlder();
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div ref={scroller} onScroll={onScroll} className="h-full overflow-y-auto overscroll-contain" tabIndex={-1}>
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 px-5 py-6 sm:px-6">
          {hasOlder && (
            <div className="flex justify-center">
              <Button size="sm" onClick={loadOlder} disabled={loadingOlder}>
                {loadingOlder ? <Spinner /> : null} Load earlier messages
              </Button>
            </div>
          )}

          {loading && (
            <div className="space-y-6" aria-busy="true" aria-label="Loading messages">
              <Skeleton className="ml-auto h-10 w-2/5" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/5" />
              </div>
            </div>
          )}

          {!loading && !!error && messages.length === 0 && (
            <div role="alert" className="py-10 text-center">
              <p className="text-sm text-fg-muted">{userMessage(error)}</p>
              <Button size="sm" className="mt-3" onClick={onRetry}>
                Try again
              </Button>
            </div>
          )}

          {messages.map((message) =>
            message.role === "user" ? (
              <UserMessage
                key={message._id}
                content={message.content}
                attachments={message.attachments}
                createdAt={message.createdAt}
              />
            ) : (
              <AssistantMessage key={message._id} message={message} />
            ),
          )}

          {pending.map((item) => (
            <div key={item.id} className="animate-fade-up flex flex-col gap-7">
              <PendingExchange item={item} />
            </div>
          ))}
        </div>
      </div>

      {showJump && (
        <button
          type="button"
          onClick={() => scrollToBottom("smooth")}
          className="absolute bottom-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full glass border border-border-strong px-3.5 py-2 text-xs font-medium text-fg shadow-pop transition-colors hover:bg-surface-2"
        >
          <ArrowDown className="size-3.5" aria-hidden /> Jump to latest
        </button>
      )}
    </div>
  );
}
