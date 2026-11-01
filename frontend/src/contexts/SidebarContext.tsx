import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { readStorage, writeStorage } from "@/utils/storage";

interface SidebarContextValue {
  /** Desktop: collapsed to a slim rail. Persisted. */
  collapsed: boolean;
  toggleCollapsed: () => void;
  /** Mobile: drawer open. */
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
}

const KEY = "omniai.sidebar";
const SidebarContext = createContext<SidebarContextValue | null>(null);

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(() => readStorage(KEY) === "collapsed");
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      writeStorage(KEY, current ? null : "collapsed");
      return !current;
    });
  }, []);

  const value = useMemo(
    () => ({ collapsed, toggleCollapsed, mobileOpen, setMobileOpen }),
    [collapsed, toggleCollapsed, mobileOpen],
  );

  return <SidebarContext.Provider value={value}>{children}</SidebarContext.Provider>;
}

export function useSidebar() {
  const context = useContext(SidebarContext);
  if (!context) throw new Error("useSidebar must be used inside SidebarProvider");
  return context;
}
