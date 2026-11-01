import path from "node:path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    server: {
      port: 5173,
      // Same-origin in dev: the browser talks to Vite, Vite forwards /api to the
      // gateway, so the session cookie works exactly as it will in production.
      proxy: {
        "/api": {
          target: env.DEV_GATEWAY_URL || "http://localhost:8000",
          changeOrigin: true,
          timeout: 200000,
          proxyTimeout: 200000,
        },
      },
    },
    test: {
      environment: "jsdom",
      // Same origin as the API, mirroring production (CloudFront serves both).
      environmentOptions: { jsdom: { url: "http://api.test/" } },
      globals: true,
      setupFiles: ["./tests/setup.ts"],
      css: false,
      env: {
        VITE_FIREBASE_API_KEY: "test",
        VITE_FIREBASE_AUTH_DOMAIN: "test.firebaseapp.com",
        VITE_FIREBASE_PROJECT_ID: "test",
        VITE_FIREBASE_APP_ID: "test",
        // Node's fetch needs absolute URLs; MSW intercepts them.
        VITE_API_BASE: "http://api.test",
      },
    },
  };
});
