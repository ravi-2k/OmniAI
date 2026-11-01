import { useEffect, useMemo, useRef } from "react";
import { MessageSquareText, SearchX } from "lucide-react";

import { useConversationsQuery } from "@/hooks/queries";
import { groupConversations } from "@/utils/dates";
import { userMessage } from "@/services/api/errors";
import { Button } from "@/components/ui/Button";
import { Skeleton, Spinner } from "@/components/ui/Feedback";
import { ConversationItem } from "./ConversationItem";

interface ConversationListProps {
  search: string;
  activeId?: string;
  onNavigate?: () => void;
}

export function ConversationList({ search, activeId, onNavigate }: ConversationListProps) {
  const query = useConversationsQuery(search);
  const sentinel = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  // Load the next page when the end of the list scrolls into view.
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasNextPage) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "120px" },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const conversations = useMemo(() => query.data?.pages.flat() ?? [], [query.data]);
  const groups = useMemo(() => groupConversations(conversations), [conversations]);

  if (query.isPending) {
    return (
      <div className="space-y-2 px-2 pt-2" aria-busy="true" aria-label="Loading chats">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-9 rounded-xl" />
        ))}
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="px-3 py-6 text-center" role="alert">
        <p className="text-sm text-fg-muted">{userMessage(query.error)}</p>
        <Button size="sm" className="mt-3" onClick={() => void query.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (!conversations.length) {
    return (
      <div className="flex flex-col items-center px-4 py-10 text-center">
        {search ? (
          <SearchX className="size-6 text-fg-subtle" aria-hidden />
        ) : (
          <MessageSquareText className="size-6 text-fg-subtle" aria-hidden />
        )}
        <p className="mt-3 text-sm font-medium text-fg">
          {search ? "No matching chats" : "No chats yet"}
        </p>
        <p className="mt-1 text-[13px] text-fg-muted">
          {search ? "Try a different search." : "Start a new chat and it will show up here."}
        </p>
      </div>
    );
  }

  return (
    <nav aria-label="Recent chats">
      {groups.map((group) => (
        <section key={group.label} className="mb-4">
          <h3 className="px-4 pb-1.5 pt-2 text-xs font-medium text-fg-subtle">{group.label}</h3>
          <ul className="space-y-1">
            {group.items.map((conversation) => (
              <ConversationItem
                key={conversation._id}
                conversation={conversation}
                active={conversation._id === activeId}
                onNavigate={onNavigate}
              />
            ))}
          </ul>
        </section>
      ))}
      <div ref={sentinel} className="flex h-8 items-center justify-center">
        {isFetchingNextPage && <Spinner className="text-fg-subtle" />}
      </div>
    </nav>
  );
}
