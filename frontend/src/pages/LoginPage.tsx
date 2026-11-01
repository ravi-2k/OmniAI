import { useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { motion } from "motion/react";
import { AlertCircle, Code2, FileText, Globe, ImageIcon, Presentation } from "lucide-react";

import { missingFirebaseConfig } from "@/config/env";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError, userMessage } from "@/services/api/errors";
import { SignInError } from "@/services/auth/firebase";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Feedback";
import { Logo } from "@/components/ui/Logo";
import { Splash } from "@/components/layout/ProtectedRoute";

const HIGHLIGHTS = [
  { icon: Globe, label: "Live web search" },
  { icon: Code2, label: "Code with live preview" },
  { icon: FileText, label: "PDF reports" },
  { icon: Presentation, label: "Slide decks" },
  { icon: ImageIcon, label: "Image understanding" },
];

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.95-2.92l-3.88-3c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.27v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.27 14.27a7.2 7.2 0 0 1 0-4.54v-3.1H1.27a12 12 0 0 0 0 10.74l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.27 6.63l4 3.1C6.22 6.88 8.87 4.77 12 4.77Z" />
    </svg>
  );
}

export default function LoginPage() {
  const { status, signIn, sessionExpired } = useAuth();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const configProblems = missingFirebaseConfig();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  if (status === "loading") return <Splash />;
  if (status === "authenticated") return <Navigate to={from} replace />;

  const onSignIn = async () => {
    setBusy(true);
    setError(null);
    try {
      await signIn();
    } catch (cause) {
      if (cause instanceof SignInError) {
        // Closing the popup is a choice, not an error.
        if (cause.kind !== "cancelled") setError(cause.message);
      } else if (cause instanceof ApiError) {
        setError(userMessage(cause));
      } else {
        setError("We couldn't sign you in. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="aurora" />

      <motion.main
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative w-full max-w-md"
      >
        <div className="glass rounded-[2rem] border border-border-strong p-8 shadow-pop sm:p-10">
          <Logo className="[&_svg]:size-10 [&_span]:text-2xl" />

          <h1 className="gradient-text mt-8 text-balance pb-0.5 text-3xl font-semibold tracking-tight">
            One place for every AI task
          </h1>
          <p className="mt-2 text-[15px] leading-relaxed text-fg-muted">
            Sign in to chat, search the web, write code, and generate documents with specialised agents.
          </p>

          {sessionExpired && !error && (
            <p role="status" className="mt-5 rounded-lg bg-surface-2 px-3.5 py-2.5 text-sm text-fg-muted">
              Your session ended. Please sign in again.
            </p>
          )}

          {(error || configProblems.length > 0) && (
            <div role="alert" className="mt-5 flex items-start gap-2.5 rounded-lg bg-danger-soft px-3.5 py-2.5">
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
              <p className="text-sm text-fg">
                {configProblems.length > 0
                  ? "Sign-in isn't configured: the Firebase settings are missing from this build."
                  : error}
              </p>
            </div>
          )}

          <Button
            size="lg"
            variant="secondary"
            className="mt-6 w-full"
            onClick={() => void onSignIn()}
            disabled={busy || configProblems.length > 0}
          >
            {busy ? <Spinner /> : <GoogleMark />}
            {busy ? "Signing in…" : "Continue with Google"}
          </Button>

          <ul className="mt-8 flex flex-wrap gap-2 border-t border-border pt-6">
            {HIGHLIGHTS.map(({ icon: Icon, label }) => (
              <li key={label} className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs text-fg-muted">
                <Icon className="size-3.5 text-accent" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>

        <p className="mt-5 text-center text-xs text-fg-subtle">
          By continuing you agree to use OmniAI responsibly. AI responses can contain mistakes.
        </p>
      </motion.main>
    </div>
  );
}
