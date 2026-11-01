import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
  globalIgnores(["dist", "coverage"]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      // Context modules legitimately export a provider and its hook together.
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },
  {
    // A context module exports its provider and the hook that reads it together.
    files: ["src/contexts/**", "src/App.tsx"],
    rules: { "react-refresh/only-export-components": "off" },
  },
]);
