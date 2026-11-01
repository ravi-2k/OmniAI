import { useCallback, useEffect, useState } from "react";

import type { StoredFile } from "@/types/api";
import { agentApi } from "@/services/api/endpoints";

interface Signed {
  url: string;
  downloadUrl: string;
  expiresAt: string;
}

// Signed URLs are valid for a while; remember them so scrolling or remounting a
// message doesn't re-request the same file.
const cache = new Map<string, Signed>();
const inflight = new Map<string, Promise<Signed>>();

const SAFETY_MS = 30_000;
const isFresh = (signed?: { url?: string; expiresAt?: string }): signed is Signed =>
  !!signed?.url && !!signed.expiresAt && new Date(signed.expiresAt).getTime() - Date.now() > SAFETY_MS;

/** One request per file at a time, shared by every card showing it. */
const fetchSigned = (file: StoredFile): Promise<Signed> => {
  const cached = cache.get(file.key);
  if (isFresh(cached)) return Promise.resolve(cached);

  let request = inflight.get(file.key);
  if (!request) {
    request = agentApi
      .fileUrl(file.key, file.name)
      .then((next) => {
        cache.set(file.key, next);
        return next;
      })
      .finally(() => inflight.delete(file.key));
    inflight.set(file.key, request);
  }
  return request;
};

/**
 * Resolves a usable URL for a stored file. The live chat response carries fresh
 * URLs; after a reload (or once they expire) a new one is requested by S3 key.
 */
export function useFileUrl(file: StoredFile, { autoLoad = false }: { autoLoad?: boolean } = {}) {
  const initial = isFresh(file) ? (file as Signed) : cache.get(file.key);
  const [signed, setSigned] = useState<Signed | undefined>(isFresh(initial) ? initial : undefined);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  /** For click handlers: always resolves to a URL that is valid right now. */
  const ensureFresh = useCallback(async (): Promise<Signed> => {
    if (isFresh(signed)) return signed;
    if (isFresh(file)) return file as Signed;
    setBusy(true);
    try {
      const next = await fetchSigned(file);
      setSigned(next);
      setFailed(false);
      return next;
    } catch (error) {
      setFailed(true);
      throw error;
    } finally {
      setBusy(false);
    }
  }, [file, signed]);

  useEffect(() => {
    if (!autoLoad || isFresh(signed) || failed) return;
    let live = true;
    fetchSigned(file)
      .then((next) => live && setSigned(next))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, [autoLoad, file, signed, failed]);

  const loading = busy || (autoLoad && !isFresh(signed) && !failed);

  return { url: signed?.url, downloadUrl: signed?.downloadUrl, loading, failed, ensureFresh };
}
