import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";

import { Button } from "./Button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  destructive,
  busy,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-[80] bg-[var(--overlay)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </Dialog.Overlay>
            <div className="fixed inset-0 z-[81] flex items-center justify-center p-4">
              <Dialog.Content asChild>
                <motion.div
                  className="w-full max-w-sm glass rounded-3xl border border-border-strong p-6 shadow-pop"
                  initial={{ opacity: 0, scale: 0.96, y: 8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 8 }}
                  transition={{ duration: 0.16 }}
                >
                  <Dialog.Title className="text-base font-semibold text-fg">{title}</Dialog.Title>
                  <Dialog.Description className="mt-1.5 text-sm leading-relaxed text-fg-muted">
                    {description}
                  </Dialog.Description>
                  <div className="mt-5 flex justify-end gap-2">
                    <Dialog.Close asChild>
                      <Button variant="secondary" disabled={busy}>
                        Cancel
                      </Button>
                    </Dialog.Close>
                    <Button variant={destructive ? "danger" : "primary"} onClick={onConfirm} disabled={busy}>
                      {busy ? "Working…" : confirmLabel}
                    </Button>
                  </div>
                </motion.div>
              </Dialog.Content>
            </div>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
