import { useState } from "react";

import { cn } from "@/utils/cn";

interface AvatarProps {
  name?: string;
  src?: string;
  className?: string;
}

const initialsOf = (name?: string) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return ((parts[0]![0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]![0] ?? "") : "")).toUpperCase();
};

/** Shows the profile photo, falling back to initials when it's missing or fails to load. */
export function Avatar({ name, src, className }: AvatarProps) {
  const [broken, setBroken] = useState(false);

  return (
    <span
      className={cn(
        "inline-flex size-8 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-brand text-xs font-semibold text-on-brand ring-2 ring-border-strong",
        className,
      )}
      aria-hidden
    >
      {src && !broken ? (
        <img
          src={src}
          alt=""
          referrerPolicy="no-referrer"
          className="size-full object-cover"
          onError={() => setBroken(true)}
        />
      ) : (
        initialsOf(name)
      )}
    </span>
  );
}
