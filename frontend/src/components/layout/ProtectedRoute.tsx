import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/contexts/AuthContext";
import { LogoMark } from "@/components/ui/Logo";

export function Splash() {
  return (
    <div className="flex h-dvh items-center justify-center bg-bg" role="status" aria-label="Loading OmniAI">
      <LogoMark className="size-12 animate-pulse" />
    </div>
  );
}

/** Only renders its routes for a signed-in user; otherwise sends them to /login and back afterwards. */
export function ProtectedRoute() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Splash />;
  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}
