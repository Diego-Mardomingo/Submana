import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP. 'unsafe-inline' en scripts es necesario para el script de tema de layout.tsx y el
 * bootstrap de Next sin nonces; aun así bloquea scripts de terceros, iframes y objetos.
 * img-src admite https: porque los iconos de cuentas/suscripciones son URLs elegidas por el usuario.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseOrigin} ${supabaseOrigin.replace("https://", "wss://")} https://api.brandfetch.io`.trim(),
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  // App financiera: no permitir que se incruste en iframes de terceros (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  experimental: {
    viewTransition: true,
  },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
});

// PWA (Serwist) solo en producción; en dev usamos Turbopack sin webpack
export default process.env.NODE_ENV === "production" ? withSerwist(nextConfig) : nextConfig;
