import { ChevronDown } from "lucide-react";

import { AGENTS, getAgent, type AgentId } from "@/config/agents";
import { cn } from "@/utils/cn";
import { Menu, MenuContent, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuTrigger } from "@/components/ui/Menu";

interface AgentSelectorProps {
  value: AgentId;
  onChange: (agent: AgentId) => void;
  disabled?: boolean;
}

export function AgentSelector({ value, onChange, disabled }: AgentSelectorProps) {
  const current = getAgent(value);
  const Icon = current.icon;

  return (
    <Menu>
      <MenuTrigger asChild disabled={disabled}>
        <button
          type="button"
          aria-label={`Agent: ${current.label}. Change agent`}
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-surface-2/70 px-3 text-[13px] font-medium text-fg transition-colors",
            "hover:border-accent/40 hover:bg-accent-soft disabled:opacity-50 data-[state=open]:border-accent/50 data-[state=open]:bg-accent-soft",
          )}
        >
          <Icon className="size-3.5 text-accent" aria-hidden />
          {current.label}
          <ChevronDown className="size-3.5 text-fg-subtle" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent side="top" align="start" className="w-[min(92vw,320px)]">
        <MenuLabel>Choose an agent</MenuLabel>
        <MenuRadioGroup value={value} onValueChange={(next) => onChange(next as AgentId)}>
          {AGENTS.map((agent) => {
            const AgentIcon = agent.icon;
            return (
              <MenuRadioItem key={agent.id} value={agent.id} className="items-start py-2">
                <AgentIcon className="mt-0.5 size-4 shrink-0 text-accent" aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{agent.label}</span>
                  <span className="block text-xs leading-snug text-fg-muted">{agent.description}</span>
                </span>
              </MenuRadioItem>
            );
          })}
        </MenuRadioGroup>
      </MenuContent>
    </Menu>
  );
}
