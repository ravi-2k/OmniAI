import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

import { readStorage, writeStorage } from "@/utils/storage";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  preference: ThemePreference;
  theme: ResolvedTheme;
  setPreference: (preference: ThemePreference) => void;
  toggle: () => void;
}

const KEY = "omniai.theme";
const ThemeContext = createContext<ThemeContextValue | null>(null);

const systemTheme = (): ResolvedTheme =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";

const initialPreference = (): ThemePreference => {
  const saved = readStorage(KEY);
  return saved === "light" || saved === "dark" ? saved : "system";
};

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(initialPreference);
  const [system, setSystem] = useState<ResolvedTheme>(systemTheme);

  useEffect(() => {
    const query = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!query) return;
    const onChange = () => setSystem(query.matches ? "dark" : "light");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const theme: ResolvedTheme = preference === "system" ? system : preference;

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    writeStorage(KEY, next === "system" ? null : next);
  }, []);

  const toggle = useCallback(
    () => setPreference(theme === "dark" ? "light" : "dark"),
    [theme, setPreference],
  );

  const value = useMemo(
    () => ({ preference, theme, setPreference, toggle }),
    [preference, theme, setPreference, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
