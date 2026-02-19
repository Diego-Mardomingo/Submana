import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import "./components.css";
import { Providers } from "./providers";

const sora = Sora({ subsets: ["latin"], variable: "--font-sora" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "Submana",
  description: "Manage your subscriptions elegantly.",
  applicationName: "Submana",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Submana" },
  formatDetection: { telephone: false },
  openGraph: { type: "website", siteName: "Submana", title: "Submana", description: "Manage your subscriptions elegantly." },
  twitter: { card: "summary", title: "Submana", description: "Manage your subscriptions elegantly." },
  icons: {
    icon: [
      { url: "/icons/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${sora.variable} ${inter.variable}`}>
      <body className="antialiased font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
