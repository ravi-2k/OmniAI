import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

import { s3 } from "../config/s3.js";

// downloadName makes the browser save the object under a friendly name
// instead of the storage key.
export const getFromS3 = async (filename, expiresIn = 3600, downloadName) => {
  const safeName = downloadName
    ? String(downloadName).replace(/["\\\r\n]/g, "_")
    : undefined;

  return await getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: filename,
      ...(safeName
        ? {
            ResponseContentDisposition: `attachment; filename="${safeName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
          }
        : {}),
    }),
    { expiresIn },
  );
};
