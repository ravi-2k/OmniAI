import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

import type { User } from "@/types/api";
import { authApi } from "@/services/api/endpoints";
import { setUnauthorizedHandler } from "@/services/api/client";
import { signInWithGoogle } from "@/services/auth/firebase";

export type AuthStatus = "loading" | "authenticated" | "unauthenticated";

interface AuthContextValue {
  status: AuthStatus;
  user: User | null;
  /** True when the last session was lost to expiry rather than a deliberate sign-out. */
  sessionExpired: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthStatus>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Restore the session on load (cookie-based, so it survives refreshes).
  useEffect(() => {
    const controller = new AbortController();
    authApi
      .getSession(controller.signal)
      .then((restored) => {
        setUser(restored);
        setStatus("authenticated");
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        // 401 = not signed in. Network trouble also lands on the login screen, which
        // reports problems on the next attempt.
        console.debug("Session restore failed", error?.code);
        setStatus("unauthenticated");
      });
    return () => controller.abort();
  }, []);

  // Any 401 from an authenticated endpoint means the session ended.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (statusRef.current !== "authenticated") return;
      queryClient.clear();
      setUser(null);
      setSessionExpired(true);
      setStatus("unauthenticated");
    });
    return () => setUnauthorizedHandler(null);
  }, [queryClient]);

  const signIn = useCallback(async () => {
    const token = await signInWithGoogle();
    const signedIn = await authApi.login(token);
    queryClient.clear();
    setSessionExpired(false);
    setUser(signedIn);
    setStatus("authenticated");
  }, [queryClient]);

  const signOut = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      // Even if the call fails, drop local state; the cookie expires server-side.
    }
    // Wipe every cached conversation so nothing leaks to the next user.
    queryClient.clear();
    setUser(null);
    setSessionExpired(false);
    setStatus("unauthenticated");
  }, [queryClient]);

  const value = useMemo(
    () => ({ status, user, sessionExpired, signIn, signOut }),
    [status, user, sessionExpired, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
