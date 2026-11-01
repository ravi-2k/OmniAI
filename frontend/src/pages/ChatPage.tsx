import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";

import type { AgentId } from "@/config/agents";
import type { Artifact } from "@/types/api";
import { useArtifacts } from "@/contexts/ArtifactContext";
import { useChatSession } from "@/contexts/ChatSessionContext";
import { useConversationQuery, useMessagesQuery } from "@/hooks/queries";
import { isApiError } from "@/services/api/errors";
import { ArtifactDock } from "@/components/artifacts/ArtifactDock";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { EmptyState } from "@/components/chat/EmptyState";
import { MessageList } from "@/components/chat/MessageList";
import { Composer, type Prefill } from "@/components/composer/Composer";
import NotFoundPage from "./NotFoundPage";

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const session = useChatSession();
  const { getPanel, openArtifact, closePanel } = useArtifacts();

  const conversation = useConversationQuery(conversationId);
  const messagesQuery = useMessagesQuery(conversationId);
  const { messages } = messagesQuery;
  const pending = session.pendingFor(conversationId);

  const [agent, setAgent] = useState<AgentId>("auto");
  const [prefill, setPrefill] = useState<Prefill | null>(null);
  const [live, setLive] = useState("");

  // A different chat starts on Auto again, except when this navigation is just
  // the first message of a new chat creating its conversation.
  const [seenId, setSeenId] = useState(conversationId);
  if (seenId !== conversationId) {
    setSeenId(conversationId);
    if (!session.isJustCreated(conversationId)) {
      setAgent("auto");
      setPrefill(null);
    }
  }
  const { clearJustCreated } = session;
  useEffect(() => clearJustCreated(conversationId), [conversationId, clearJustCreated]);

  const title = conversationId ? (conversation.data?.title ?? "Chat") : "New chat";
  useEffect(() => {
    document.title = conversationId && conversation.data ? `${conversation.data.title} · OmniAI` : "OmniAI";
  }, [conversationId, conversation.data]);

  // Announce progress to screen readers.
  const working = pending.some((item) => item.status === "working");
  const failed = pending.some((item) => item.status === "failed");
  const [liveKey, setLiveKey] = useState(`${conversationId ?? ""}|${working}`);
  const nextLiveKey = `${conversationId ?? ""}|${working}`;
  if (nextLiveKey !== liveKey) {
    const sameChat = liveKey.split("|")[0] === (conversationId ?? "");
    setLiveKey(nextLiveKey);
    setLive(!sameChat ? "" : working ? "Generating a response…" : failed ? "The request failed." : "Response received.");
  }

  const hasConversationPdf = useMemo(
    () =>
      messages.some((message) => message.attachments?.some((file) => file.mimeType === "application/pdf")) ||
      pending.some((item) => item.file?.type === "application/pdf"),
    [messages, pending],
  );

  const panel = getPanel(conversationId);
  const lastArtifact: Artifact | undefined = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const found = messages[i]?.artifacts?.find((artifact) => artifact.files?.length);
      if (found) return found;
    }
    return undefined;
  }, [messages]);

  const notFound =
    (isApiError(conversation.error) && conversation.error.code === "CONVERSATION_NOT_FOUND") ||
    (isApiError(conversation.error) && conversation.error.status === 400);
  if (conversationId && notFound) return <NotFoundPage message="This conversation doesn't exist" />;

  const isEmpty =
    messages.length === 0 && pending.length === 0 && (!conversationId || !messagesQuery.isPending);

  const toggleArtifacts = () => {
    if (!conversationId) return;
    if (panel?.open) closePanel(conversationId);
    else if (panel?.artifact ?? lastArtifact) openArtifact(conversationId, (panel?.artifact ?? lastArtifact)!);
  };

  return (
    <div className="flex min-w-0 flex-1">
      <section className="glass-panel flex min-w-0 flex-1 flex-col overflow-hidden max-lg:border-0 max-lg:shadow-none lg:rounded-3xl" aria-label="Conversation">
        <ChatHeader
          title={title}
          messageCount={conversation.data?.messageCount}
          agent={agent}
          artifactsAvailable={!!(panel?.artifact ?? lastArtifact)}
          artifactsOpen={!!panel?.open}
          onToggleArtifacts={toggleArtifacts}
        />

        <div className="sr-only-live" role="status" aria-live="polite">
          {live}
        </div>

        {isEmpty ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <EmptyState
              onPick={(text, nextAgent) => {
                setAgent(nextAgent);
                setPrefill({ text, nonce: Date.now() });
              }}
            />
          </div>
        ) : (
          <MessageList
            conversationId={conversationId ?? ""}
            messages={messages}
            pending={pending}
            loading={messagesQuery.isPending && pending.length === 0}
            error={messagesQuery.error}
            onRetry={() => void messagesQuery.refetch()}
            hasOlder={!!messagesQuery.hasNextPage}
            loadingOlder={messagesQuery.isFetchingNextPage}
            onLoadOlder={() => void messagesQuery.fetchNextPage()}
          />
        )}

        <Composer
          conversationId={conversationId}
          agent={agent}
          onAgentChange={setAgent}
          hasConversationPdf={hasConversationPdf}
          prefill={prefill}
        />
      </section>

      {conversationId && <ArtifactDock conversationId={conversationId} artifact={panel?.artifact} open={!!panel?.open} />}
    </div>
  );
}
