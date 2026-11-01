import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

type ToastVariant = "info" | "success" | "error";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (input: { title: string; description?: string; variant?: ToastVariant }) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS = { info: Info, success: CheckCircle2, error: AlertCircle } as const;
const COLORS = { info: "text-fg-muted", success: "text-success", error: "text-danger" } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback<ToastContextValue["toast"]>(
    ({ title, description, variant = "info" }) => {
      const id = nextId.current++;
      setItems((current) => [...current.slice(-3), { id, title, description, variant }]);
      window.setTimeout(() => dismiss(id), variant === "error" ? 7000 : 4500);
    },
    [dismiss],
  );

  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4"
        role="region"
        aria-label="Notifications"
        aria-live="polite"
      >
        <AnimatePresence initial={false}>
          {items.map((item) => {
            const Icon = ICONS[item.variant];
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 12, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="pointer-events-auto flex w-full max-w-sm items-start gap-3 glass rounded-2xl border border-border-strong p-4 shadow-pop"
                role={item.variant === "error" ? "alert" : "status"}
              >
                <Icon className={`mt-0.5 size-4 shrink-0 ${COLORS[item.variant]}`} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-fg">{item.title}</p>
                  {item.description && <p className="mt-0.5 text-sm text-fg-muted">{item.description}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-md p-0.5 text-fg-subtle hover:text-fg"
                  aria-label="Dismiss notification"
                >
                  <X className="size-4" />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error("useToast must be used inside ToastProvider");
  return context.toast;
}
