import { useRef, type KeyboardEvent } from "react";

import type { ArtifactFile } from "@/types/api";
import { cn } from "@/utils/cn";

interface FileTabsProps {
  files: ArtifactFile[];
  active: number;
  onSelect: (index: number) => void;
  panelId: string;
}

const baseName = (path: string) => path.split("/").pop() || path;

export function FileTabs({ files, active, onSelect, panelId }: FileTabsProps) {
  const list = useRef<HTMLDivElement>(null);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const last = files.length - 1;
    const keyToIndex: Record<string, number> = {
      ArrowRight: active === last ? 0 : active + 1,
      ArrowLeft: active === 0 ? last : active - 1,
      Home: 0,
      End: last,
    };
    const next = keyToIndex[event.key];
    if (next === undefined) return;
    event.preventDefault();
    onSelect(next);
    list.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
  };

  return (
    <div
      ref={list}
      role="tablist"
      aria-label="Project files"
      onKeyDown={onKeyDown}
      className="flex min-w-0 gap-0.5 overflow-x-auto px-2 pt-1.5"
    >
      {files.map((file, index) => {
        const selected = index === active;
        return (
          <button
            key={`${file.name}-${index}`}
            type="button"
            role="tab"
            id={`${panelId}-tab-${index}`}
            aria-selected={selected}
            aria-controls={`${panelId}-panel`}
            tabIndex={selected ? 0 : -1}
            title={file.name}
            onClick={() => onSelect(index)}
            className={cn(
              "max-w-44 shrink-0 truncate rounded-t-lg border border-b-0 px-3 py-1.5 font-mono text-xs transition-colors",
              selected
                ? "border-border bg-surface text-fg"
                : "border-transparent text-fg-muted hover:bg-surface-2 hover:text-fg",
            )}
          >
            {baseName(file.name)}
          </button>
        );
      })}
    </div>
  );
}
