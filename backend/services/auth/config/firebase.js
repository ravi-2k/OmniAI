import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";

// The service account must never be baked into the image. Supply it with, in order:
//   FIREBASE_SERVICE_ACCOUNT_BASE64  base64 of the JSON (recommended for ECS / secrets manager)
//   FIREBASE_SERVICE_ACCOUNT         the raw JSON string
//   FIREBASE_SERVICE_ACCOUNT_PATH    path to the JSON file (local development;
//                                    defaults to services/auth/firebaseServiceAcc.json)
const loadServiceAccount = () => {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
    return JSON.parse(
      Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_BASE64, "base64").toString(
        "utf8",
      ),
    );
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  const filePath =
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    fileURLToPath(new URL("../firebaseServiceAcc.json", import.meta.url));

  if (fs.existsSync(filePath)) {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  }

  throw new Error(
    "Firebase service account is not configured. Set FIREBASE_SERVICE_ACCOUNT_BASE64, FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_PATH.",
  );
};

export const app = initializeApp({
  credential: cert(loadServiceAccount()),
});
