import type { ReactElement } from "react";
import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";

import { ArtifactProvider } from "@/contexts/ArtifactContext";
import { ChatSessionProvider } from "@/contexts/ChatSessionContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { TooltipProvider } from "@/components/ui/Button";

export const makeClient = () =>
  new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } } });

/** Everything a signed-in screen needs, minus auth (tests control the API directly). */
export function renderApp(ui: ReactElement, { route = "/", client = makeClient() } = {}) {
  return {
    client,
    ...render(
      <QueryClientProvider client={client}>
        <ThemeProvider>
          <TooltipProvider>
            <ToastProvider>
              <MemoryRouter initialEntries={[route]}>
                <SidebarProvider>
                  <ArtifactProvider>
                    <ChatSessionProvider>{ui}</ChatSessionProvider>
                  </ArtifactProvider>
                </SidebarProvider>
              </MemoryRouter>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>,
    ),
  };
}
