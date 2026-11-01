import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import multer from "multer";

import { HttpError } from "../../../shared/http/errors.js";

// Temp files are removed by the controller once the request finishes.
const uploadDir =
  process.env.UPLOAD_DIR || path.join(os.tmpdir(), "omniai-uploads");

fs.mkdirSync(uploadDir, { recursive: true });

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;

const IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
];

const storage = multer.diskStorage({
  destination(req, file, cb) {
    cb(null, uploadDir);
  },
  filename(req, file, cb) {
    const extension = path
      .extname(file.originalname)
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, "")
      .slice(0, 8);
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString("hex")}${extension}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === "application/pdf" || IMAGE_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new HttpError(
        415,
        "UNSUPPORTED_FILE_TYPE",
        "Only PDF and image files (JPEG, PNG, WebP, GIF, HEIC) are allowed.",
      ),
    );
  }
};

export default multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
    files: 1,
  },
});
