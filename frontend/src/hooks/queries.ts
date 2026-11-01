import { useMemo } from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
  type QueryClient,
} from "@tanstack/react-query";

import type { Conversation, Feedback, Message } from "@/types/api";
import { conversationsApi, messagesApi } from "@/services/api/endpoints";

export const CONVERSATION_PAGE = 30;
export const MESSAGE_PAGE = 50;

export const keys = {
  conversations: (q: string) => ["conversations", q] as const,
  conversationsAll: ["conversations"] as const,
  conversation: (id: string) => ["conversation", id] as const,
  messages: (id: string) => ["messages", id] as const,
};

export function useConversationsQuery(q: string) {
  return useInfiniteQuery({
    queryKey: keys.conversations(q),
    queryFn: ({ pageParam, signal }) =>
      conversationsApi.list({ limit: CONVERSATION_PAGE, before: pageParam, q: q || undefined }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) =>
      last.length === CONVERSATION_PAGE ? last[last.length - 1]?.updatedAt : undefined,
  });
}

export function useConversationQuery(id: string | undefined) {
  return useQuery({
    queryKey: keys.conversation(id ?? ""),
    queryFn: ({ signal }) => conversationsApi.get(id!, signal),
    enabled: !!id,
  });
}

/** Pages are newest-first internally; `messages` is oldest -> newest for display. */
export function useMessagesQuery(conversationId: string | undefined) {
  const query = useInfiniteQuery({
    queryKey: keys.messages(conversationId ?? ""),
    queryFn: ({ pageParam, signal }) =>
      messagesApi.list(conversationId!, { limit: MESSAGE_PAGE, before: pageParam }, signal),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.length === MESSAGE_PAGE ? last[0]?._id : undefined),
    enabled: !!conversationId,
  });

  const messages = useMemo(
    () => (query.data ? [...query.data.pages].reverse().flat() : []),
    [query.data],
  );

  return { ...query, messages };
}

type MessagePages = InfiniteData<Message[], string | undefined>;

/** Appends freshly saved messages to the newest page without refetching. */
export const appendMessages = (client: QueryClient, conversationId: string, added: Message[]) => {
  client.setQueryData<MessagePages>(keys.messages(conversationId), (current) => {
    if (!current) return { pages: [added], pageParams: [undefined] };
    const [newest = [], ...older] = current.pages;
    const known = new Set(newest.map((message) => message._id));
    return {
      ...current,
      pages: [[...newest, ...added.filter((message) => !known.has(message._id))], ...older],
    };
  });
};

const patchMessage = (
  client: QueryClient,
  conversationId: string,
  messageId: string,
  patch: Partial<Message>,
) => {
  client.setQueryData<MessagePages>(keys.messages(conversationId), (current) =>
    current
      ? {
          ...current,
          pages: current.pages.map((page) =>
            page.map((message) => (message._id === messageId ? { ...message, ...patch } : message)),
          ),
        }
      : current,
  );
};

export function useRenameConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => conversationsApi.rename(id, title),
    onSuccess: (updated: Conversation) => {
      client.setQueryData(keys.conversation(updated._id), updated);
      client.invalidateQueries({ queryKey: keys.conversationsAll });
    },
  });
}

export function useDeleteConversation() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => conversationsApi.remove(id),
    onSuccess: (_data, id) => {
      client.removeQueries({ queryKey: keys.conversation(id) });
      client.removeQueries({ queryKey: keys.messages(id) });
      client.invalidateQueries({ queryKey: keys.conversationsAll });
    },
  });
}

export function useFeedbackMutation(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ messageId, value }: { messageId: string; value: Feedback | null }) =>
      messagesApi.feedback(messageId, value),
    onMutate: ({ messageId, value }) => {
      patchMessage(client, conversationId, messageId, { feedback: value ?? undefined });
    },
    onError: () => {
      // Roll back to the server's truth.
      client.invalidateQueries({ queryKey: keys.messages(conversationId) });
    },
  });
}
