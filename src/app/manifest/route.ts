import { NextRequest } from "next/server";

const defaultManifest = {
  name: "Submana",
  short_name: "Submana",
  description: "Manage your subscriptions elegantly.",
  start_url: "/",
  display: "standalone" as const,
  background_color: "#0f1012",
  theme_color: "#8b5cf6",
  orientation: "portrait" as const,
  icons: [
    {
      src: "/icons/web-app-manifest-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable" as const,
    },
    {
      src: "/icons/web-app-manifest-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable" as const,
    },
    {
      src: "/icons/web-app-manifest-192x192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: "/icons/web-app-manifest-512x512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: "/icons/favicon.svg",
      sizes: "any",
      type: "image/svg+xml",
      purpose: "any" as const,
    },
  ],
  shortcuts: [
    {
      name: "Transacciones",
      short_name: "Transacciones",
      url: "/transactions",
      icons: [
        {
          src: "/icons/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any" as const,
        },
      ],
    },
    {
      name: "Cuentas",
      short_name: "Cuentas",
      url: "/accounts",
      icons: [
        {
          src: "/icons/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any" as const,
        },
      ],
    },
    {
      name: "Presupuestos",
      short_name: "Presupuestos",
      url: "/budgets",
      icons: [
        {
          src: "/icons/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any" as const,
        },
      ],
    },
    {
      name: "Suscripciones",
      short_name: "Suscripciones",
      url: "/subscriptions",
      icons: [
        {
          src: "/icons/web-app-manifest-192x192.png",
          sizes: "192x192",
          type: "image/png",
          purpose: "any" as const,
        },
      ],
    },
  ],
};

const windowsManifest = {
  ...defaultManifest,
  theme_color: "#0f1012",
  icons: [
    {
      src: "/icons/icon-192-windows.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "maskable" as const,
    },
    {
      src: "/icons/icon-512-windows.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable" as const,
    },
    {
      src: "/icons/icon-192-windows.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any" as const,
    },
    {
      src: "/icons/icon-512-windows.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any" as const,
    },
  ],
  shortcuts: defaultManifest.shortcuts.map((s) => ({
    ...s,
    icons: [{ src: "/icons/icon-192-windows.png", sizes: "192x192", type: "image/png", purpose: "any" as const }],
  })),
};

function isWindowsDesktop(userAgent: string): boolean {
  const isWindows = /Windows|Win32|Win64/i.test(userAgent);
  const isMobile = /Mobile|Android/i.test(userAgent);
  return isWindows && !isMobile;
}

export async function GET(request: NextRequest) {
  const userAgent = request.headers.get("user-agent") ?? "";
  const manifest = isWindowsDesktop(userAgent) ? windowsManifest : defaultManifest;

  return new Response(JSON.stringify(manifest), {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
