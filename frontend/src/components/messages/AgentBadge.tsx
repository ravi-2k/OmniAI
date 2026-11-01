import { describeBackendAgent } from "@/config/agents";

/** Shows which agent produced a reply (useful when Auto chose it). */
export function AgentBadge({ agent }: { agent?: string }) {
  const info = describeBackendAgent(agent);
  if (!info) return null;
  const Icon = info.icon;

  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-[11px] font-semibold text-accent">
      <Icon className="size-3" aria-hidden />
      {info.label}
    </span>
  );
}
