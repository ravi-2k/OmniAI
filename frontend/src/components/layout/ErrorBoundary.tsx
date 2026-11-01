import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Rendered instead of the default full-page message. */
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  failed: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Log the technical detail for developers; never show it to users.
    console.error("UI error:", error, info.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.fallback) return this.props.fallback;

    return (
      <div role="alert" className="flex h-dvh flex-col items-center justify-center gap-3 bg-bg p-6 text-center">
        <h1 className="text-xl font-semibold text-fg">Something went wrong</h1>
        <p className="max-w-sm text-sm text-fg-muted">
          The app hit an unexpected problem. Reloading usually fixes it, and your chats are safe.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 h-9 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
        >
          Reload
        </button>
      </div>
    );
  }
}
