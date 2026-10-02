import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
const isDev = process.env.NODE_ENV !== "production";

/**
 * CSP. Scripts need 'unsafe-inline' for the theme script in layout.tsx and Next's bootstrap
 * without nonces; it still blocks third-party scripts, iframes and objects.
 * img-src allows https: because account/subscription icons are user-chosen URLs.
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
  // Finance app: never embeddable in third-party iframes (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      // The service worker's own fetches are bound by the CSP served with sw.js. With the app's
      // connect-src it blocked every remote image it intercepts (bank/subscription logos, flags),
      // so it gets a policy allowing https fetches. Later entries override the same header key.
      { source: "/sw.js", headers: [{ key: "Content-Security-Policy", value: "default-src 'self'; connect-src 'self' https:" }] },
    ];
  },
  experimental: { viewTransition: true },
};

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  additionalPrecacheEntries: [{ url: "/~offline", revision: "1" }],
  disable: process.env.NODE_ENV !== "production",
});

export default withSerwist(nextConfig);
