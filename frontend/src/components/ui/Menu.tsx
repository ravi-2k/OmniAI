import type { ComponentProps } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";

import { cn } from "@/utils/cn";

export const Menu = DropdownMenu.Root;
export const MenuTrigger = DropdownMenu.Trigger;
export const MenuRadioGroup = DropdownMenu.RadioGroup;

export function MenuContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof DropdownMenu.Content>) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          "glass z-[70] min-w-48 origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-2xl border border-border-strong/70 p-1.5 shadow-pop outline-none",
          "data-[state=open]:animate-[menu-in_0.14s_ease-out]",
          className,
        )}
        {...props}
      />
    </DropdownMenu.Portal>
  );
}

const itemClass =
  "relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-2 text-sm text-fg outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-accent-soft";

export function MenuItem({ className, danger, ...props }: ComponentProps<typeof DropdownMenu.Item> & { danger?: boolean }) {
  return <DropdownMenu.Item className={cn(itemClass, danger && "text-danger", className)} {...props} />;
}

export function MenuRadioItem({ className, children, ...props }: ComponentProps<typeof DropdownMenu.RadioItem>) {
  return (
    <DropdownMenu.RadioItem className={cn(itemClass, "pr-8", className)} {...props}>
      {children}
      <DropdownMenu.ItemIndicator className="absolute right-2.5 inline-flex size-4 items-center justify-center text-accent">
        <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="m3.5 8.5 3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.RadioItem>
  );
}

export function MenuLabel({ className, ...props }: ComponentProps<typeof DropdownMenu.Label>) {
  return (
    <DropdownMenu.Label
      className={cn("px-2.5 pb-1 pt-1.5 text-xs font-medium uppercase tracking-wide text-fg-subtle", className)}
      {...props}
    />
  );
}

export function MenuSeparator({ className, ...props }: ComponentProps<typeof DropdownMenu.Separator>) {
  return <DropdownMenu.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />;
}
