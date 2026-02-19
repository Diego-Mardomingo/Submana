"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { useRouter } from "next/navigation";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

const COOKIE_LANG = "submana-lang";
const COOKIE_THEME = "submana-theme";

function getTheme(): "light" | "dark" {
  if (typeof document === "undefined") return "dark";
  return (localStorage.getItem(COOKIE_THEME) as "light" | "dark") || "dark";
}

export default function SettingsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const router = useRouter();
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [user, setUser] = useState<{ email?: string; user_metadata?: { name?: string; avatar_url?: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<"light" | "dark">("dark");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      setLoading(false);
    });
    setTheme(getTheme());
    const stored = document.documentElement.getAttribute("data-theme");
    if (stored) document.documentElement.setAttribute("data-theme", stored);
  }, [supabase]);

  const handleThemeChange = (newTheme: "light" | "dark") => {
    setTheme(newTheme);
    document.documentElement.setAttribute("data-theme", newTheme);
    localStorage.setItem(COOKIE_THEME, newTheme);
    document.cookie = `${COOKIE_THEME}=${newTheme}; path=/; max-age=${60 * 60 * 24 * 365}`;
  };

  const handleLangChange = (newLang: "en" | "es") => {
    localStorage.setItem(COOKIE_LANG, newLang);
    document.cookie = `submana-lang=${newLang}; path=/; max-age=${60 * 60 * 24 * 365}`;
    router.refresh();
    window.location.reload();
  };

  const handleSignOut = async (e: React.FormEvent) => {
    e.preventDefault();
    await supabase.auth.signOut();
    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    window.location.href = "/login";
  };

  return (
    <div className="page-container fade-in" style={{ maxWidth: 500 }}>
      <div style={{ marginBottom: 32, display: "flex", alignItems: "center", gap: 12 }}>
        <svg width="40" height="40" viewBox="0 0 512 512" fill="none">
          <rect width="512" height="512" rx="120" fill="url(#grad)" />
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="512" y2="512">
              <stop stopColor="#8B5CF6" />
              <stop offset="1" stopColor="#3B82F6" />
            </linearGradient>
          </defs>
        </svg>
        <span style={{ fontSize: "1.5rem", fontWeight: 800 }}>Submana</span>
      </div>
      {loading ? (
        <div className="skeleton" style={{ height: 120, marginBottom: 24 }} />
      ) : (
        <div style={{ marginBottom: 32 }}>
          {user?.user_metadata?.avatar_url ? (
            <img
              src={user.user_metadata.avatar_url}
              alt=""
              style={{ width: 80, height: 80, borderRadius: "50%", marginBottom: 16 }}
              referrerPolicy="no-referrer"
            />
          ) : (
            <div
              style={{
                width: 80,
                height: 80,
                borderRadius: "50%",
                background: "var(--gris-oscuro)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 16,
              }}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0 -18 0" />
                <path d="M12 10m-3 0a3 3 0 1 0 6 0a3 3 0 1 0 -6 0" />
                <path d="M6.168 18.849a4 4 0 0 1 3.832 -2.849h4a4 4 0 0 1 3.834 2.855" />
              </svg>
            </div>
          )}
          <h2 style={{ margin: 0, marginBottom: 4 }}>{user?.user_metadata?.name || "User"}</h2>
          <p style={{ margin: 0, color: "var(--gris-claro)", fontSize: "0.9rem" }}>{user?.email}</p>
        </div>
      )}
      <div style={{ marginBottom: 24 }}>
        <h3 style={{ marginBottom: 12, fontSize: "1rem" }}>{t("settings.preferences")}</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{t("settings.theme")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleThemeChange("light")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: theme === "light" ? "2px solid var(--accent)" : "1px solid var(--gris)",
                  background: theme === "light" ? "var(--accent-soft)" : "transparent",
                  color: theme === "light" ? "var(--accent)" : "var(--gris-claro)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="5" />
                  <line x1="12" y1="1" x2="12" y2="3" />
                  <line x1="12" y1="21" x2="12" y2="23" />
                  <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
                  <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
                  <line x1="1" y1="12" x2="3" y2="12" />
                  <line x1="21" y1="12" x2="23" y2="12" />
                  <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
                  <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
                </svg>
                {t("settings.theme.light")}
              </button>
              <button
                type="button"
                onClick={() => handleThemeChange("dark")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: theme === "dark" ? "2px solid var(--accent)" : "1px solid var(--gris)",
                  background: theme === "dark" ? "var(--accent-soft)" : "transparent",
                  color: theme === "dark" ? "var(--accent)" : "var(--gris-claro)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
                </svg>
                {t("settings.theme.dark")}
              </button>
            </div>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>{t("settings.language")}</span>
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                onClick={() => handleLangChange("en")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: lang === "en" ? "2px solid var(--accent)" : "1px solid var(--gris)",
                  background: lang === "en" ? "var(--accent-soft)" : "transparent",
                  color: lang === "en" ? "var(--accent)" : "var(--gris-claro)",
                  cursor: "pointer",
                }}
              >
                English
              </button>
              <button
                type="button"
                onClick={() => handleLangChange("es")}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: lang === "es" ? "2px solid var(--accent)" : "1px solid var(--gris)",
                  background: lang === "es" ? "var(--accent-soft)" : "transparent",
                  color: lang === "es" ? "var(--accent)" : "var(--gris-claro)",
                  cursor: "pointer",
                }}
              >
                Español
              </button>
            </div>
          </div>
        </div>
      </div>
      <form onSubmit={handleSignOut}>
        <button
          type="submit"
          style={{
            width: "100%",
            padding: "12px 24px",
            background: "var(--danger-soft)",
            color: "var(--danger)",
            border: "1px solid var(--danger-muted)",
            borderRadius: 8,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {t("settings.signout")}
        </button>
      </form>
    </div>
  );
}
