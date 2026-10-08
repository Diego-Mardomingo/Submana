import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import "./components.css";
import "./list-pages.css";
import "./dashboard.css";
import "./home.css";
import "./sheet.css";
import "./toast.css";
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
    icon: { url: "/favicon.svg", type: "image/svg+xml" },
    apple: "/icons/apple-touch-icon.png?v=2",
  },
  manifest: "/manifest",
};

export const viewport: Viewport = {
  themeColor: "#8b5cf6",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <body className="antialiased font-sans" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            // Applies the saved theme before paint and follows the OS while it is "system".
            __html: `(function(){var c=(document.cookie.match(/submana-theme=([^;]+)/)||[])[1],m=matchMedia('(prefers-color-scheme: dark)');function a(){var t=localStorage.getItem('submana-theme')||c||'system';document.documentElement.setAttribute('data-theme',t==='system'?(m.matches?'dark':'light'):t)}a();m.addEventListener('change',a)})();`,
          }}
        />
        <div className="ios-top-edge" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
