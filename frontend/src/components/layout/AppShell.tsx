import { Outlet } from "react-router-dom";
import { WifiOff } from "lucide-react";

import { ArtifactProvider } from "@/contexts/ArtifactContext";
import { ChatSessionProvider } from "@/contexts/ChatSessionContext";
import { SidebarProvider } from "@/contexts/SidebarContext";
import { useOnline } from "@/hooks/utility";
import { Sidebar } from "@/components/sidebar/Sidebar";

function OfflineBanner() {
  const online = useOnline();
  if (online) return null;

  return (
    <div
      role="status"
      className="flex items-center justify-center gap-2 bg-warning/15 px-3 py-1.5 text-xs font-medium text-fg"
    >
      <WifiOff className="size-3.5 text-warning" aria-hidden />
      You're offline. Messages can't be sent until you reconnect.
    </div>
  );
}

/** Signed-in frame: sidebar + routed content. These providers reset on sign-out. */
export function AppShell() {
  return (
    <SidebarProvider>
      <ArtifactProvider>
        <ChatSessionProvider>
          <div className="flex h-dvh flex-col overflow-hidden">
            <OfflineBanner />
            <div className="flex min-h-0 flex-1">
              <Sidebar />
              <main className="flex min-w-0 flex-1 lg:p-3">
                <Outlet />
              </main>
            </div>
          </div>
        </ChatSessionProvider>
      </ArtifactProvider>
    </SidebarProvider>
  );
}
