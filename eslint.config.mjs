import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            { name: "sonner", message: "Use `toast` from \"@/lib/toast\" (see AGENTS.md → Toasts)." },
            { name: "@/components/ui/sonner", message: "The app's <Toaster /> is already mounted in providers; fire toasts with `toast` from \"@/lib/toast\"." },
          ],
        },
      ],
    },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", "public/sw.js"]),
]);
