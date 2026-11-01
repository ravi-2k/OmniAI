import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "motion/react";
import { Download, ImageOff, X } from "lucide-react";

import type { StoredFile } from "@/types/api";
import { useFileUrl } from "@/hooks/useFileUrl";
import { openUrl } from "@/utils/download";
import { cn } from "@/utils/cn";
import { IconButton } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Feedback";

interface ImageThumbProps {
  file: StoredFile;
  small?: boolean;
}

/** An image from storage with a click-to-enlarge viewer. URLs are refreshed when they've expired. */
export function ImageThumb({ file, small }: ImageThumbProps) {
  const { url, loading, failed, ensureFresh } = useFileUrl(file, { autoLoad: true });
  const [open, setOpen] = useState(false);
  const [retried, setRetried] = useState(false);
  const [broken, setBroken] = useState(false);

  const onError = () => {
    // A signed URL can expire between render and load; try one refresh.
    if (!retried) {
      setRetried(true);
      void ensureFresh().catch(() => setBroken(true));
    } else {
      setBroken(true);
    }
  };

  if (failed || broken) {
    return (
      <div className="flex h-28 w-44 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-border-strong text-fg-subtle">
        <ImageOff className="size-5" aria-hidden />
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }

  if (!url || loading) return <Skeleton className={small ? "size-24" : "h-56 w-72 max-w-full"} />;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "block overflow-hidden rounded-xl border border-border bg-surface-2 transition-opacity hover:opacity-95",
          small ? "size-24" : "max-w-full",
        )}
        aria-label={`View image ${file.name}`}
      >
        <img
          src={url}
          alt={file.name}
          loading="lazy"
          onError={onError}
          className={cn("object-cover", small ? "size-24" : "max-h-96 w-auto max-w-full")}
        />
      </button>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <AnimatePresence>
          {open && (
            <Dialog.Portal forceMount>
              <Dialog.Overlay asChild>
                <motion.div
                  className="fixed inset-0 z-[85] bg-black/80"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                />
              </Dialog.Overlay>
              <Dialog.Content
                aria-describedby={undefined}
                className="fixed inset-0 z-[86] flex items-center justify-center p-4 outline-none sm:p-10"
                onClick={() => setOpen(false)}
              >
                <Dialog.Title className="sr-only">{file.name}</Dialog.Title>
                <motion.img
                  src={url}
                  alt={file.name}
                  className="max-h-full max-w-full rounded-lg object-contain shadow-pop"
                  initial={{ scale: 0.96, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.96, opacity: 0 }}
                  onClick={(event) => event.stopPropagation()}
                />
                <div className="absolute right-4 top-4 flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <IconButton
                    label="Download image"
                    variant="secondary"
                    onClick={async () => {
                      try {
                        openUrl((await ensureFresh()).downloadUrl, false);
                      } catch {
                        /* the card already shows an error state if the file is gone */
                      }
                    }}
                  >
                    <Download className="size-4" />
                  </IconButton>
                  <Dialog.Close asChild>
                    <IconButton label="Close" variant="secondary">
                      <X className="size-4" />
                    </IconButton>
                  </Dialog.Close>
                </div>
              </Dialog.Content>
            </Dialog.Portal>
          )}
        </AnimatePresence>
      </Dialog.Root>
    </>
  );
}
