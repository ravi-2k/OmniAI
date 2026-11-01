const read = (value: unknown) => (typeof value === "string" ? value : "");

export const env = {
  /** Empty string = same origin. Set only if the API lives on another origin. */
  apiBase: read(import.meta.env.VITE_API_BASE).replace(/\/$/, ""),
  firebase: {
    apiKey: read(import.meta.env.VITE_FIREBASE_API_KEY),
    authDomain: read(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: read(import.meta.env.VITE_FIREBASE_PROJECT_ID),
    appId: read(import.meta.env.VITE_FIREBASE_APP_ID),
  },
};

export const missingFirebaseConfig = (): string[] =>
  Object.entries(env.firebase)
    .filter(([, value]) => !value)
    .map(([key]) => key);

export const LIMITS = {
  maxUploadBytes: 20 * 1024 * 1024,
  promptMaxLength: 8000,
  /** A little above the gateway's 180s agent timeout. */
  chatTimeoutMs: 190_000,
  requestTimeoutMs: 30_000,
};
