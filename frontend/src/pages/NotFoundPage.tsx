import { Link } from "react-router-dom";

export default function NotFoundPage({ message }: { message?: string }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-5xl font-semibold tracking-tight text-fg-subtle">404</p>
      <h1 className="text-lg font-semibold text-fg">{message ?? "This page doesn't exist"}</h1>
      <Link
        to="/"
        className="mt-2 inline-flex h-9 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg hover:bg-accent-hover"
      >
        Start a new chat
      </Link>
    </div>
  );
}
