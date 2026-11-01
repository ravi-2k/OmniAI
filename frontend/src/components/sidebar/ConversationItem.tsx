import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import type { Conversation } from "@/types/api";
import { useDeleteConversation, useRenameConversation } from "@/hooks/queries";
import { useToast } from "@/contexts/ToastContext";
import { userMessage } from "@/services/api/errors";
import { cn } from "@/utils/cn";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/Menu";

interface ConversationItemProps {
  conversation: Conversation;
  active: boolean;
  onNavigate?: () => void;
}

export function ConversationItem({ conversation, active, onNavigate }: ConversationItemProps) {
  const navigate = useNavigate();
  const toast = useToast();
  const rename = useRenameConversation();
  const remove = useDeleteConversation();

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(conversation.title);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = () => {
    setDraft(conversation.title);
    setEditing(true);
  };

  const commit = () => {
    const title = draft.trim();
    setEditing(false);
    if (!title || title === conversation.title) return;
    rename.mutate(
      { id: conversation._id, title },
      { onError: (error) => toast({ title: "Couldn't rename chat", description: userMessage(error), variant: "error" }) },
    );
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") commit();
    if (event.key === "Escape") setEditing(false);
  };

  const confirmDelete = () => {
    remove.mutate(conversation._id, {
      onSuccess: () => {
        setConfirmOpen(false);
        if (active) navigate("/", { replace: true });
      },
      onError: (error) => {
        setConfirmOpen(false);
        toast({ title: "Couldn't delete chat", description: userMessage(error), variant: "error" });
      },
    });
  };

  if (editing) {
    return (
      <li className="px-1">
        <input
          ref={inputRef}
          value={draft}
          maxLength={120}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commit}
          onKeyDown={onKeyDown}
          aria-label="Chat title"
          className="h-10 w-full rounded-xl border border-accent bg-surface px-3 text-sm text-fg outline-none shadow-[0_0_0_3px_var(--accent-soft)]"
        />
      </li>
    );
  }

  return (
    <li className="group/item relative px-1">
      <Link
        to={`/c/${conversation._id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        title={conversation.title}
        className={cn(
          "relative flex h-10 items-center rounded-xl pl-3 pr-9 text-sm transition-colors",
          active
            ? "bg-surface font-medium text-fg shadow-card ring-1 ring-inset ring-border-strong/70 before:absolute before:left-0 before:top-2.5 before:h-5 before:w-[3px] before:rounded-full before:bg-brand"
            : "text-fg-muted hover:bg-surface/70 hover:text-fg",
        )}
      >
        <span className="truncate">{conversation.title}</span>
      </Link>

      <Menu>
        <MenuTrigger asChild>
          <button
            type="button"
            aria-label={`Options for ${conversation.title}`}
            className={cn(
              "absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-md text-fg-subtle transition-opacity hover:bg-surface-3 hover:text-fg",
              "opacity-0 focus-visible:opacity-100 group-focus-within/item:opacity-100 group-hover/item:opacity-100 data-[state=open]:opacity-100",
              "max-lg:opacity-100",
            )}
          >
            <MoreHorizontal className="size-4" />
          </button>
        </MenuTrigger>
        <MenuContent align="start" className="min-w-40">
          <MenuItem onSelect={startEditing}>
            <Pencil className="size-4 text-fg-muted" /> Rename
          </MenuItem>
          <MenuSeparator />
          <MenuItem danger onSelect={() => setConfirmOpen(true)}>
            <Trash2 className="size-4" /> Delete
          </MenuItem>
        </MenuContent>
      </Menu>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Delete this chat?"
        description={`"${conversation.title}" and all of its messages will be permanently deleted.`}
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onConfirm={confirmDelete}
      />
    </li>
  );
}
