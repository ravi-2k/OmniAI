import type { Conversation } from "@/types/api";

export interface ConversationGroup {
  label: string;
  items: Conversation[];
}

const startOfDay = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

const DAY = 24 * 60 * 60 * 1000;

/** Groups by real `updatedAt` (local time): Today, Yesterday, Previous 7 days, Older. */
export const groupConversations = (
  conversations: Conversation[],
  now: Date = new Date(),
): ConversationGroup[] => {
  const today = startOfDay(now);
  const buckets: ConversationGroup[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];

  for (const conversation of conversations) {
    const day = startOfDay(new Date(conversation.updatedAt));
    const target =
      day >= today ? 0 : day >= today - DAY ? 1 : day >= today - 7 * DAY ? 2 : 3;
    buckets[target]!.items.push(conversation);
  }

  return buckets.filter((bucket) => bucket.items.length > 0);
};

export const formatTime = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export const formatDateTime = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};
