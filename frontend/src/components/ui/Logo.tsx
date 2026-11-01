import { useId } from "react";

import { cn } from "@/utils/cn";

/**
 * The OmniAI mark: a glowing coffee-toned tile holding a four-point star ("the spark")
 * with a tilted orbit and a satellite ("many agents around one mind").
 * On hover the orbit completes a turn and the star pulses (see .logo-* in index.css).
 */
export function LogoMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("logo-mark size-8 drop-shadow-[0_6px_14px_rgb(150_95_55/0.5)]", className)}
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="2" y1="0" x2="30" y2="32" gradientUnits="userSpaceOnUse">
          <stop stopColor="#EDC38F" />
          <stop offset="0.5" stopColor="#BC8458" />
          <stop offset="1" stopColor="#7C4B30" />
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx="0.3" cy="0.1" r="0.9">
          <stop stopColor="#fff" stopOpacity="0.55" />
          <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="32" height="32" rx="10" fill={`url(#${id}-bg)`} />
      <rect width="32" height="32" rx="10" fill={`url(#${id}-shine)`} />
      <rect x="0.5" y="0.5" width="31" height="31" rx="9.5" stroke="#fff" strokeOpacity="0.35" />
      <g className="logo-orbit">
        <g transform="rotate(-28 16 16)">
          <ellipse cx="16" cy="16" rx="12.5" ry="5" stroke="#fff" strokeOpacity="0.7" strokeWidth="1.4" />
          <circle cx="28.5" cy="16" r="2.3" fill="#fff" />
        </g>
      </g>
      <path
        className="logo-star"
        d="M16 7.6c.55 5 3.3 7.8 8.4 8.4-5.1.6-7.85 3.4-8.4 8.4-.55-5-3.3-7.8-8.4-8.4 5.1-.6 7.85-3.4 8.4-8.4Z"
        fill="#fff"
      />
    </svg>
  );
}

export function Logo({ className, showWordmark = true }: { className?: string; showWordmark?: boolean }) {
  return (
    <span className={cn("logo inline-flex items-center gap-3", className)}>
      <LogoMark />
      {showWordmark && <span className="text-[18px] font-semibold tracking-tight text-fg">OmniAI</span>}
    </span>
  );
}
