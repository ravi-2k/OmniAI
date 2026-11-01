import { useState } from "react";
import { Check, Copy, ThumbsDown, ThumbsUp } from "lucide-react";

import type { Feedback, Message } from "@/types/api";
import { useFeedbackMutation } from "@/hooks/queries";
import { useToast } from "@/contexts/ToastContext";
import { copyText } from "@/utils/download";
import { formatDateTime } from "@/utils/dates";
import { cn } from "@/utils/cn";
import { IconButton } from "@/components/ui/Button";

export function MessageActions({ message }: { message: Message }) {
  const toast = useToast();
  const feedback = useFeedbackMutation(message.conversationId);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (await copyText(message.content)) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } else {
      toast({ title: "Couldn't copy", description: "Your browser blocked clipboard access.", variant: "error" });
    }
  };

  const vote = (value: Feedback) => {
    // Clicking the active vote clears it.
    feedback.mutate(
      { messageId: message._id, value: message.feedback === value ? null : value },
      { onError: () => toast({ title: "Couldn't save feedback", variant: "error" }) },
    );
  };

  return (
    <div className="mt-2 flex items-center gap-0.5 text-fg-subtle">
      <IconButton label={copied ? "Copied" : "Copy response"} size="sm" onClick={copy} tooltipSide="top">
        {copied ? <Check className="size-4 text-success" /> : <Copy className="size-4" />}
      </IconButton>
      <IconButton
        label="Good response"
        size="sm"
        tooltipSide="top"
        aria-pressed={message.feedback === "up"}
        onClick={() => vote("up")}
        className={cn(message.feedback === "up" && "bg-accent-soft text-accent")}
      >
        <ThumbsUp className="size-4" />
      </IconButton>
      <IconButton
        label="Bad response"
        size="sm"
        tooltipSide="top"
        aria-pressed={message.feedback === "down"}
        onClick={() => vote("down")}
        className={cn(message.feedback === "down" && "bg-danger-soft text-danger")}
      >
        <ThumbsDown className="size-4" />
      </IconButton>
      <time dateTime={message.createdAt} className="ml-2 text-xs">
        {formatDateTime(message.createdAt)}
      </time>
    </div>
  );
}
