import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  turbopack: {},
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
