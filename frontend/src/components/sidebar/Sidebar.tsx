import { useState } from "react";
import { useMatch, useNavigate } from "react-router-dom";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { PanelLeftClose, PanelLeftOpen, Plus, Search, X } from "lucide-react";

import { useSidebar } from "@/contexts/SidebarContext";
import { useDebouncedValue, useIsMobile } from "@/hooks/utility";
import { Button, IconButton } from "@/components/ui/Button";
import { Logo, LogoMark } from "@/components/ui/Logo";
import { ConversationList } from "./ConversationList";
import { UserMenu } from "./UserMenu";

function SidebarContent({
  collapsed,
  onNavigate,
  headerAction,
}: {
  collapsed: boolean;
  onNavigate?: () => void;
  headerAction: React.ReactNode;
}) {
  const navigate = useNavigate();
  const match = useMatch("/c/:conversationId");
  const [search, setSearch] = useState("");
  const debounced = useDebouncedValue(search.trim(), 300);

  const newChat = () => {
    navigate("/");
    onNavigate?.();
  };

  if (collapsed) {
    return (
      <div className="flex h-full flex-col items-center gap-3 py-5">
        <LogoMark className="size-9" />
        {headerAction}
        <IconButton label="New chat" variant="secondary" tooltipSide="right" onClick={newChat}>
          <Plus className="size-4" />
        </IconButton>
        <div className="mt-auto w-full px-2">
          <UserMenu compact />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-5 pb-4 pt-5">
        <Logo />
        {headerAction}
      </div>

      <div className="space-y-3.5 px-4 pb-3">
        <Button variant="primary" size="md" className="w-full justify-start" onClick={newChat}>
          <Plus className="size-4" aria-hidden /> New chat
        </Button>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search chats"
            aria-label="Search chats"
            maxLength={100}
            className="h-10 w-full rounded-xl border border-border bg-surface/70 pl-9 pr-2.5 text-sm text-fg outline-none transition-[border-color,box-shadow] placeholder:text-fg-subtle focus:border-accent/70 focus:shadow-[0_0_0_3px_var(--accent-soft)]"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1 pb-2">
        <h2 className="sr-only">Recents</h2>
        <p className="px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle" aria-hidden>
          Recents
        </p>
        <ConversationList search={debounced} activeId={match?.params.conversationId} onNavigate={onNavigate} />
      </div>

      <div className="p-3 pt-2">
        <UserMenu />
      </div>
    </div>
  );
}

export function Sidebar() {
  const { collapsed, toggleCollapsed, mobileOpen, setMobileOpen } = useSidebar();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Dialog.Root open={mobileOpen} onOpenChange={setMobileOpen}>
        <AnimatePresence>
          {mobileOpen && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-40 bg-[var(--overlay)]"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>
              <Dialog.Content asChild aria-describedby={undefined}>
                <motion.aside
                  className="fixed inset-y-0 left-0 z-50 w-[min(86vw,320px)] glass border-r border-border-strong shadow-pop"
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 420, damping: 40 }}
                >
                  <Dialog.Title className="sr-only">Navigation</Dialog.Title>
                  <SidebarContent
                    collapsed={false}
                    onNavigate={() => setMobileOpen(false)}
                    headerAction={
                      <Dialog.Close asChild>
                        <IconButton label="Close menu">
                          <X className="size-4" />
                        </IconButton>
                      </Dialog.Close>
                    }
                  />
                </motion.aside>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    );
  }

  return (
    <motion.aside
      aria-label="Sidebar"
      className="glass-panel shrink-0 overflow-hidden rounded-3xl lg:my-3 lg:ml-3"
      initial={false}
      animate={{ width: collapsed ? 72 : 300 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
    >
      {/* Fixed-width inner layers so the content never reflows while the shell resizes; they cross-fade. */}
      <motion.div
        key={collapsed ? "collapsed" : "expanded"}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.12 }}
        className={collapsed ? "h-full w-[72px]" : "h-full w-[300px]"}
      >
        <SidebarContent
          collapsed={collapsed}
          headerAction={
            <IconButton
              label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              tooltipSide={collapsed ? "right" : "bottom"}
              onClick={toggleCollapsed}
            >
              {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
            </IconButton>
          }
        />
      </motion.div>
    </motion.aside>
  );
}
