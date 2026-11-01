import { LIMITS } from "@/config/env";
import type { FileAccept } from "@/config/agents";

export const PDF_TYPE = "application/pdf";
export const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

export const isPdf = (mimeType?: string) => mimeType === PDF_TYPE;
export const isImage = (mimeType?: string) => !!mimeType && mimeType.startsWith("image/");

export const formatBytes = (bytes?: number) => {
  if (bytes === undefined || !Number.isFinite(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(bytes < 10 * 1024 ? 1 : 0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** `accept` attribute for the hidden file input. */
export const acceptAttribute = (accepts: FileAccept): string => {
  switch (accepts) {
    case "pdf":
      return PDF_TYPE;
    case "image":
      return IMAGE_TYPES.join(",");
    case "pdf-or-image":
      return [PDF_TYPE, ...IMAGE_TYPES].join(",");
    default:
      return "";
  }
};

/** Returns an error message, or null when the file is acceptable. */
export const validateFile = (file: File, accepts: FileAccept): string | null => {
  if (accepts === "none") return "This agent doesn't use attachments.";

  const okPdf = accepts === "pdf" || accepts === "pdf-or-image";
  const okImage = accepts === "image" || accepts === "pdf-or-image";
  const typeOk = (okPdf && isPdf(file.type)) || (okImage && IMAGE_TYPES.includes(file.type));

  if (!typeOk) {
    if (accepts === "pdf") return "This agent only accepts PDF files.";
    if (accepts === "image") return "This agent only accepts images (JPEG, PNG, WebP, GIF, HEIC).";
    return "Only PDFs and images (JPEG, PNG, WebP, GIF, HEIC) are supported.";
  }

  if (file.size > LIMITS.maxUploadBytes) {
    return `That file is too large (${formatBytes(file.size)}). The limit is ${formatBytes(LIMITS.maxUploadBytes)}.`;
  }

  if (file.size === 0) return "That file is empty.";

  return null;
};
