import type { NextRequest } from "next/server";

const icon = (size: number, purpose: "any" | "maskable") => ({
  src: `/icons/web-app-manifest-${size}x${size}.png`,
  sizes: `${size}x${size}`,
  type: "image/png",
  purpose,
});

const shortcuts = [
  ["Transacciones", "/transactions"],
  ["Cuentas", "/accounts"],
  ["Presupuestos", "/budgets"],
  ["Suscripciones", "/subscriptions"],
].map(([name, url]) => ({ name, short_name: name, url, icons: [icon(192, "any")] }));

const manifest = {
  name: "Submana",
  short_name: "Submana",
  description: "Manage your subscriptions elegantly.",
  start_url: "/",
  display: "standalone",
  background_color: "#0f1012",
  theme_color: "#8b5cf6",
  orientation: "portrait",
  icons: [
    icon(192, "maskable"),
    icon(512, "maskable"),
    icon(192, "any"),
    icon(512, "any"),
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
  ],
  shortcuts,
};

/** Desktop Windows uses the dark background as title bar colour. */
export function GET(request: NextRequest) {
  const ua = request.headers.get("user-agent") ?? "";
  const isWindowsDesktop = /Windows|Win32|Win64/i.test(ua) && !/Mobile|Android/i.test(ua);
  const body = isWindowsDesktop ? { ...manifest, theme_color: manifest.background_color } : manifest;
  return Response.json(body, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=0, must-revalidate",
    },
  });
}
