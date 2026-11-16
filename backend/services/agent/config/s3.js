import { S3Client } from "@aws-sdk/client-s3";

// Works with AWS S3 and any S3-compatible store (Supabase Storage, R2, MinIO).
// Set S3_ENDPOINT to point at a non-AWS provider.
export const s3 = new S3Client({
  region: process.env.AWS_REGION,
  ...(process.env.S3_ENDPOINT
    ? { endpoint: process.env.S3_ENDPOINT, forcePathStyle: true }
    : {}),
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  },
});
