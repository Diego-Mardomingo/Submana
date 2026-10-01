import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Iconos de cuentas/suscripciones: URLs arbitrarias elegidas por el usuario o data: URIs.
      // next/image exigiría declarar cada dominio en remotePatterns.
      "@next/next/no-img-element": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "astro/**",
    "scripts/**",
  ]),
]);

export default eslintConfig;
