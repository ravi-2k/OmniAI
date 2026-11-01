import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApiError } from "@/services/api/errors";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { TooltipProvider } from "@/components/ui/Button";
import { AppShell } from "@/components/layout/AppShell";
import { ErrorBoundary } from "@/components/layout/ErrorBoundary";
import { ProtectedRoute, Splash } from "@/components/layout/ProtectedRoute";

const LoginPage = lazy(() => import("@/pages/LoginPage"));
const ChatPage = lazy(() => import("@/pages/ChatPage"));
const NotFoundPage = lazy(() => import("@/pages/NotFoundPage"));

export const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        // Client errors (4xx) won't fix themselves, so only retry network / server failures.
        retry: (failureCount, error) =>
          failureCount < 2 && !(error instanceof ApiError && error.status >= 400 && error.status < 500),
      },
    },
  });

const queryClient = createQueryClient();

export default function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TooltipProvider delayDuration={350}>
            <ToastProvider>
              <BrowserRouter>
                <AuthProvider>
                  <Suspense fallback={<Splash />}>
                    <Routes>
                      <Route path="/login" element={<LoginPage />} />
                      <Route element={<ProtectedRoute />}>
                        <Route element={<AppShell />}>
                          <Route index element={<ChatPage />} />
                          <Route path="c/:conversationId" element={<ChatPage />} />
                          <Route path="*" element={<NotFoundPage />} />
                        </Route>
                      </Route>
                    </Routes>
                  </Suspense>
                </AuthProvider>
              </BrowserRouter>
            </ToastProvider>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
