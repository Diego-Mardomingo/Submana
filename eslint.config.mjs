import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// Not migrated to `@/lib/toast` yet. Remove each file once it is; delete sonner when the list is empty.
const legacySonner = [
  "src/app/providers.tsx",
  "src/components/ui/sonner.tsx",
  "src/components/AddShortcutsOverlay.tsx",
  "src/components/FriendsBody.tsx",
  "src/components/GroupDetail.tsx",
  "src/components/GroupsBody.tsx",
  "src/components/HandleSetup.tsx",
  "src/components/JointAccountSection.tsx",
  "src/hooks/useReorder.ts",
];

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: legacySonner,
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
