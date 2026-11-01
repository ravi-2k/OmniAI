import type { Artifact } from "@/types/api";

const triggerDownload = (href: string, filename?: string, newTab = false) => {
  const anchor = document.createElement("a");
  anchor.href = href;
  if (filename) anchor.download = filename;
  if (newTab) {
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
  }
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
};

/** Opens or downloads a remote (signed) URL. */
export const openUrl = (url: string, newTab = true) => triggerDownload(url, undefined, newTab);

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  triggerDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
};

export const downloadTextFile = (filename: string, content: string) => {
  const name = filename.split("/").pop() || "file.txt";
  downloadBlob(new Blob([content], { type: "text/plain;charset=utf-8" }), name);
};

export const zipName = (artifact: Artifact) => {
  const base = artifact.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `${base || "project"}.zip`;
};

/** Builds a ZIP of every file in the artifact (fflate is loaded on demand). */
export const downloadArtifactZip = async (artifact: Artifact) => {
  const { zipSync, strToU8 } = await import("fflate");
  const entries: Record<string, Uint8Array> = {};
  for (const file of artifact.files) {
    entries[file.name] = strToU8(file.content);
  }
  const zipped = zipSync(entries);
  downloadBlob(new Blob([zipped as BlobPart], { type: "application/zip" }), zipName(artifact));
};

export const copyText = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
};
