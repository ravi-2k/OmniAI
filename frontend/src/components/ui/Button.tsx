import type { ButtonHTMLAttributes, ReactNode, Ref } from "react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";

import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-brand font-semibold text-on-brand shadow-glow ring-1 ring-inset ring-white/30 hover:brightness-105 hover:saturate-125 active:scale-[0.97] disabled:opacity-45 disabled:shadow-none",
  secondary:
    "border border-border-strong bg-surface text-fg backdrop-blur-xl hover:border-accent/50 hover:bg-surface-2 active:scale-[0.98] disabled:opacity-50",
  ghost: "text-fg-muted hover:bg-surface-2 hover:text-fg disabled:opacity-40",
  danger: "bg-danger text-white hover:opacity-90 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 gap-1.5 rounded-xl px-3 text-[13px]",
  md: "h-10 gap-2 rounded-xl px-4 text-sm",
  lg: "h-12 gap-2.5 rounded-2xl px-5 text-[15px]",
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  ref?: Ref<HTMLButtonElement>;
}

export function Button({ variant = "secondary", size = "md", className, type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center whitespace-nowrap font-medium transition-[background-color,filter,box-shadow,border-color,color,transform] duration-300",
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  /** Accessible name; also shown as a tooltip. */
  label: string;
  children: ReactNode;
  variant?: Variant;
  size?: "sm" | "md";
  tooltipSide?: "top" | "right" | "bottom" | "left";
  ref?: Ref<HTMLButtonElement>;
}

export function IconButton({
  label,
  children,
  variant = "ghost",
  size = "md",
  tooltipSide = "bottom",
  className,
  type = "button",
  ...props
}: IconButtonProps) {
  return (
    <TooltipPrimitive.Root delayDuration={350}>
      <TooltipPrimitive.Trigger asChild>
        <button
          type={type}
          aria-label={label}
          className={cn(
            "inline-flex shrink-0 items-center justify-center rounded-xl transition-[background-color,filter,box-shadow,color] duration-200",
            size === "sm" ? "size-8" : "size-9",
            VARIANTS[variant],
            className,
          )}
          {...props}
        >
          {children}
        </button>
      </TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={tooltipSide}
          sideOffset={6}
          className="z-[90] rounded-lg bg-fg px-2.5 py-1 text-xs font-medium text-bg shadow-pop"
        >
          {label}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

export const TooltipProvider = TooltipPrimitive.Provider;
