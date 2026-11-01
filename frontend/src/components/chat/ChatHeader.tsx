import { Menu as MenuIcon, PanelRightClose, PanelRightOpen } from "lucide-react";

import { getAgent, type AgentId } from "@/config/agents";
import { useSidebar } from "@/contexts/SidebarContext";
import { useIsMobile } from "@/hooks/utility";
import { IconButton } from "@/components/ui/Button";
import { Logo } from "@/components/ui/Logo";

interface ChatHeaderProps {
  title: string;
  messageCount?: number;
  agent: AgentId;
  /** Show the artifacts toggle only when this chat has generated code. */
  artifactsAvailable: boolean;
  artifactsOpen: boolean;
  onToggleArtifacts: () => void;
}

export function ChatHeader({
  title,
  messageCount,
  agent,
  artifactsAvailable,
  artifactsOpen,
  onToggleArtifacts,
}: ChatHeaderProps) {
  const { setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();
  const current = getAgent(agent);
  const Icon = current.icon;

  return (
    <header className="flex h-16 shrink-0 items-center gap-3 px-4 sm:px-6">
      {isMobile && (
        <IconButton label="Open menu" onClick={() => setMobileOpen(true)}>
          <MenuIcon className="size-5" />
        </IconButton>
      )}
      {isMobile && <Logo showWordmark={false} className="mr-1 [&_svg]:size-6" />}

      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[15px] font-semibold tracking-tight text-fg" title={title}>
          {title}
        </h1>
        {messageCount !== undefined && messageCount > 0 && (
          <p className="text-xs text-fg-muted">
            {messageCount} {messageCount === 1 ? "message" : "messages"}
          </p>
        )}
      </div>

      <span
        className="hidden items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-medium text-fg-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] sm:inline-flex"
        title="Selected agent"
      >
        <Icon className="size-3.5 text-accent" aria-hidden />
        {current.label}
      </span>

      {artifactsAvailable && (
        <IconButton
          label={artifactsOpen ? "Hide artifacts" : "Show artifacts"}
          onClick={onToggleArtifacts}
          aria-pressed={artifactsOpen}
        >
          {artifactsOpen ? <PanelRightClose className="size-5" /> : <PanelRightOpen className="size-5" />}
        </IconButton>
      )}
    </header>
  );
}
