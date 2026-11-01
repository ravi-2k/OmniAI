import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { Artifact } from "@/types/api";
import { readStorage, writeStorage } from "@/utils/storage";

interface PanelState {
  artifact: Artifact;
  open: boolean;
}

interface ArtifactContextValue {
  /** Panel state for one conversation. State is keyed by conversation, so it never leaks between chats. */
  getPanel: (conversationId: string | undefined) => PanelState | undefined;
  openArtifact: (conversationId: string, artifact: Artifact) => void;
  closePanel: (conversationId: string) => void;
  width: number;
  setWidth: (width: number) => void;
}

const WIDTH_KEY = "omniai.artifactWidth";
export const MIN_PANEL_WIDTH = 380;
export const DEFAULT_PANEL_WIDTH = 560;

const ArtifactContext = createContext<ArtifactContextValue | null>(null);

const initialWidth = () => {
  const saved = Number(readStorage(WIDTH_KEY));
  return Number.isFinite(saved) && saved >= MIN_PANEL_WIDTH ? saved : DEFAULT_PANEL_WIDTH;
};

export function ArtifactProvider({ children }: { children: ReactNode }) {
  const [panels, setPanels] = useState<Record<string, PanelState>>({});
  const [width, setWidthState] = useState(initialWidth);

  const getPanel = useCallback(
    (conversationId: string | undefined) => (conversationId ? panels[conversationId] : undefined),
    [panels],
  );

  const openArtifact = useCallback((conversationId: string, artifact: Artifact) => {
    setPanels((current) => ({ ...current, [conversationId]: { artifact, open: true } }));
  }, []);

  const closePanel = useCallback((conversationId: string) => {
    setPanels((current) => {
      const existing = current[conversationId];
      return existing ? { ...current, [conversationId]: { ...existing, open: false } } : current;
    });
  }, []);

  const setWidth = useCallback((next: number) => {
    setWidthState(next);
    writeStorage(WIDTH_KEY, String(Math.round(next)));
  }, []);

  const value = useMemo(
    () => ({ getPanel, openArtifact, closePanel, width, setWidth }),
    [getPanel, openArtifact, closePanel, width, setWidth],
  );

  return <ArtifactContext.Provider value={value}>{children}</ArtifactContext.Provider>;
}

export function useArtifacts() {
  const context = useContext(ArtifactContext);
  if (!context) throw new Error("useArtifacts must be used inside ArtifactProvider");
  return context;
}
