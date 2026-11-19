import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import "./components.css";
import "./list-pages.css";
import "./subcount.css";
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
  themeColor: "#0f1012",
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
            // Applies the saved theme before paint and follows the OS while it is "system"; the
            // browser's theme-color (Safari's bars) follows the theme's background.
            __html: `(function(){var r=document.documentElement,c=(document.cookie.match(/submana-theme=([^;]+)/)||[])[1],m=matchMedia('(prefers-color-scheme: dark)');function a(){var t=localStorage.getItem('submana-theme')||c||'system';r.setAttribute('data-theme',t==='system'?(m.matches?'dark':'light'):t)}function s(){var e=document.querySelector('meta[name="theme-color"]');if(e)e.setAttribute('content',r.getAttribute('data-theme')==='light'?'#f8f9fb':'#0f1012')}a();s();m.addEventListener('change',a);new MutationObserver(s).observe(r,{attributes:true,attributeFilter:['data-theme']})})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            // Folds the desktop sidebar before paint if the user left it folded (useSidebarCollapsed).
            __html: `try{if(localStorage.getItem('submana-sidebar')==='collapsed')document.documentElement.setAttribute('data-sidebar','collapsed')}catch(e){}`,
          }}
        />
        <div className="ios-top-edge" aria-hidden />
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
