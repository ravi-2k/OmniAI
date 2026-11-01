import { LogOut, Monitor, Moon, Sun } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import { useTheme, type ThemePreference } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuTrigger,
} from "@/components/ui/Menu";

export function UserMenu({ compact }: { compact?: boolean }) {
  const { user, signOut } = useAuth();
  const { preference, setPreference } = useTheme();
  const name = user?.name || user?.email || "Account";

  return (
    <Menu>
      <MenuTrigger asChild>
        <button
          type="button"
          aria-label={`Account menu for ${name}`}
          className={cn(
            "flex w-full items-center rounded-2xl text-left transition-colors hover:bg-surface/80",
            compact ? "justify-center p-1.5" : "gap-3 p-2.5",
          )}
        >
          <Avatar name={user?.name || user?.email} src={user?.avatar} className="size-9" />
          {!compact && (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-fg">{user?.name || "Signed in"}</span>
              {user?.email && <span className="block truncate text-xs text-fg-muted">{user.email}</span>}
            </span>
          )}
        </button>
      </MenuTrigger>
      <MenuContent side={compact ? "right" : "top"} align="start" className="w-60">
        <MenuLabel>Theme</MenuLabel>
        <MenuRadioGroup value={preference} onValueChange={(value) => setPreference(value as ThemePreference)}>
          <MenuRadioItem value="light">
            <Sun className="size-4 text-fg-muted" /> Light
          </MenuRadioItem>
          <MenuRadioItem value="dark">
            <Moon className="size-4 text-fg-muted" /> Dark
          </MenuRadioItem>
          <MenuRadioItem value="system">
            <Monitor className="size-4 text-fg-muted" /> System
          </MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4 text-fg-muted" /> Sign out
        </MenuItem>
      </MenuContent>
    </Menu>
  );
}
