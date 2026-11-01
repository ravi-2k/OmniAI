import { useEffect, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from "react";

export function useMediaQuery(query: string): boolean {
  const subscribe = (callback: () => void) => {
    const media = window.matchMedia(query);
    media.addEventListener("change", callback);
    return () => media.removeEventListener("change", callback);
  };
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Below Tailwind's `lg` breakpoint. */
export const useIsMobile = () => !useMediaQuery("(min-width: 1024px)");

export function useOnline(): boolean {
  return useSyncExternalStore(
    (callback) => {
      window.addEventListener("online", callback);
      window.addEventListener("offline", callback);
      return () => {
        window.removeEventListener("online", callback);
        window.removeEventListener("offline", callback);
      };
    },
    () => navigator.onLine,
    () => true,
  );
}

export function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

/** Grows a textarea with its content up to `maxHeight` px. */
export function useAutoResize(ref: RefObject<HTMLTextAreaElement | null>, value: string, maxHeight = 220) {
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    element.style.height = "auto";
    const content = element.scrollHeight;
    // While the content still fits the CSS min-height, leave the height to CSS: pinning it here
    // would hold a focus-expanded size after the text is erased and the field loses focus.
    const floor = parseFloat(getComputedStyle(element).minHeight) || 0;
    if (content > floor + 1) element.style.height = `${Math.min(content, maxHeight)}px`;
    element.style.overflowY = content > maxHeight ? "auto" : "hidden";
  }, [ref, value, maxHeight]);
}
