"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy, EyeOff, KeyRound, Languages, LogOut, Monitor, Moon, Palette, Sun } from "lucide-react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { CompactPageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccounts } from "@/hooks/useAccounts";
import { setLang, useLang } from "@/hooks/useLang";
import { setPrivacyMode, usePrivacyMode } from "@/hooks/usePrivacyMode";
import { api } from "@/lib/api";
import { createClientStore } from "@/lib/clientStore";
import { useTranslations } from "@/lib/i18n/utils";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Theme = "light" | "dark" | "system";
const THEME_KEY = "submana-theme";

/** Persisted theme; the inline script in the root layout applies it on load and follows the OS for "system". */
const themeStore = createClientStore<Theme>(
  () => (localStorage.getItem(THEME_KEY) as Theme) || "system",
  (theme) => {
    localStorage.setItem(THEME_KEY, theme);
    document.cookie = `${THEME_KEY}=${theme}; path=/; max-age=${60 * 60 * 24 * 365}`;
    const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  },
  "system"
);

/** Pill selector with a sliding highlight (styled by `kind`). */
function Segmented<T extends string>({ kind, value, options, onChange, animate = true }: {
  kind: "theme" | "lang";
  value: T;
  options: { value: T; label: string; icon: React.ReactNode; className?: string }[];
  onChange: (value: T) => void;
  animate?: boolean;
}) {
  return (
    <div className={cn(`settings-${kind}-selector`, !animate && "settings-theme-selector-no-transition")} data-active={value}>
      <div className={`settings-${kind}-slider`} />
      {options.map((option) => (
        <Tooltip key={option.value}>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className={cn(`settings-${kind}-btn flex-1`, option.className, value === option.value && `settings-${kind}-btn-active`)}
              onClick={() => onChange(option.value)}
            >
              {option.icon}
              <span>{option.label}</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="top">{option.label}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}

function CopyButton({ text, label, ghost }: { text: string; label: string; ghost?: boolean }) {
  const t = useTranslations(useLang());
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => undefined);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button type="button" variant={ghost ? "ghost" : "outline"} size="sm" className={ghost ? "shrink-0 h-8" : undefined} onClick={copy}>
      <Copy className="size-3.5 mr-1" />
      {copied ? t("settings.automation.copied") : label}
    </Button>
  );
}

const flag = (country: string) => (
  // eslint-disable-next-line @next/next/no-img-element -- tiny remote flag
  <img src={`https://flagcdn.com/w40/${country}.png`} alt="" className="settings-lang-flag" />
);

const SectionHead = ({ title }: { title: string }) => (
  <div className="lp-section-head">
    <span className="lp-section-title">{title}</span>
  </div>
);

export default function SettingsBody() {
  const lang = useLang();
  const es = lang === "es";
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const theme = themeStore.useValue();
  const privacyMode = usePrivacyMode();
  const { data: accounts = [] } = useAccounts();
  const { data: user, isLoading } = useQuery({ queryKey: ["user"], queryFn: async () => (await createClient().auth.getUser()).data.user });
  const { data: token } = useQuery({
    queryKey: ["automation-token"],
    queryFn: () => api<{ hasToken: boolean; lastUsedAt: string | null }>("/api/automation/token"),
    enabled: !!user,
  });
  const [newToken, setNewToken] = useState<string | null>(null);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [automationOpen, setAutomationOpen] = useState(false);
  // Avoid animating the theme slider from its server position on first paint.
  const [sliderReady, setSliderReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setSliderReady(true)));
    return () => cancelAnimationFrame(frame);
  }, []);

  const generateToken = async () => {
    const { token: plain } = await api<{ token: string }>("/api/automation/token", "POST");
    setNewToken(plain);
    queryClient.setQueryData(["automation-token"], { hasToken: true, lastUsedAt: null });
  };

  const revokeToken = async () => {
    await api("/api/automation/token", "DELETE");
    setNewToken(null);
    queryClient.setQueryData(["automation-token"], { hasToken: false, lastUsedAt: null });
  };

  const signOut = async () => {
    await createClient().auth.signOut();
    // Leave no user data on the device (React Query, pages/RSC cached by the service worker).
    queryClient.clear();
    try {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== "static-assets" && name !== "fonts").map((name) => caches.delete(name)));
    } catch {
      // Cache Storage may be unavailable (private mode); the redirect still happens.
    }
    window.location.href = "/login";
  };

  const endpointUrl = typeof window !== "undefined" ? `${window.location.origin}/api/automation/quick-transaction` : "";
  const exampleBody = JSON.stringify({ amount: "10.5", description: "Café", accountId: accounts[0]?.id ?? "YOUR_ACCOUNT_ID" }, null, 2);
  const name = user?.user_metadata?.name as string | undefined;
  const tokenStatus = newToken || token?.hasToken
    ? token?.lastUsedAt
      ? `${t("settings.automation.lastUsed")} ${new Date(token.lastUsedAt).toLocaleString(es ? "es-ES" : "en-US", { dateStyle: "short", timeStyle: "short" })}`
      : t("settings.automation.tokenConfigured")
    : es ? "Sin token" : "No token";

  return (
    <div className="page-container lp-page fade-in">
      <CompactPageHeader title={t("nav.settings")} />

      <div className="lp-layout">
        <aside className="lp-aside">
          <div className="lp-card lp-profile">
            {isLoading ? (
              <>
                <div className="skeleton" style={{ width: 52, height: 52, borderRadius: "50%", flexShrink: 0 }} />
                <div className="flex flex-col gap-2 flex-1">
                  <div className="skeleton" style={{ height: 14, width: "55%" }} />
                  <div className="skeleton" style={{ height: 11, width: "80%" }} />
                </div>
              </>
            ) : (
              <>
                <Avatar className="lp-avatar">
                  {user?.user_metadata?.avatar_url && <AvatarImage src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" />}
                  <AvatarFallback className="lp-avatar-fallback">{(name || user?.email || "?").charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="lp-main">
                  <p className="lp-profile-name">{name || "User"}</p>
                  <p className="lp-profile-email">{user?.email}</p>
                </div>
              </>
            )}
          </div>
        </aside>

        <div className="lp-content">
          <section className="lp-section">
            <SectionHead title={t("settings.preferences")} />
            <div className="lp-card lp-group">
              <div className="lp-row lp-row--static lp-pref lp-pref--stack">
                <span className="lp-icon" aria-hidden>
                  <Palette className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{t("settings.theme")}</span>
                  </span>
                </span>
                <div className="lp-pref-control">
                  <Segmented
                    kind="theme"
                    value={theme}
                    onChange={themeStore.set}
                    animate={sliderReady}
                    options={[
                      { value: "light", label: t("settings.theme.light"), icon: <Sun className="size-4" /> },
                      { value: "system", label: t("settings.theme.system"), icon: <Monitor className="size-4" />, className: "settings-theme-btn-system" },
                      { value: "dark", label: t("settings.theme.dark"), icon: <Moon className="size-4" /> },
                    ]}
                  />
                </div>
              </div>

              <div className="lp-row lp-row--static lp-pref lp-pref--stack">
                <span className="lp-icon" aria-hidden>
                  <Languages className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{t("settings.language")}</span>
                  </span>
                </span>
                <div className="lp-pref-control">
                  <Segmented
                    kind="lang"
                    value={lang}
                    onChange={setLang}
                    options={[
                      { value: "en", label: "English", icon: flag("us") },
                      { value: "es", label: "Español", icon: flag("es") },
                    ]}
                  />
                </div>
              </div>

              <label className="lp-row lp-pref">
                <span className="lp-icon" aria-hidden>
                  <EyeOff className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{t("settings.privacyMode")}</span>
                  </span>
                  <span className="lp-desc">{t("settings.privacyModeDesc")}</span>
                </span>
                <Switch className="lp-pref-control" checked={privacyMode} onCheckedChange={setPrivacyMode} aria-label={t("settings.privacyMode")} />
              </label>
            </div>
          </section>

          <section className="lp-section">
            <SectionHead title={es ? "Automatización" : "Automation"} />
            <Collapsible open={automationOpen} onOpenChange={setAutomationOpen} className="lp-card lp-group">
              <CollapsibleTrigger className="lp-row">
                <span className="lp-icon" aria-hidden>
                  <KeyRound className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{es ? "Transacciones desde notificaciones" : "Transactions from notifications"}</span>
                  </span>
                  <span className="lp-meta">
                    <span className="lp-truncate">{tokenStatus}</span>
                  </span>
                </span>
                <ChevronDown className="lp-chevron size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="subs-collapsible-content">
                <div className="subs-collapsible-inner">
                  <div className="lp-panel">
                    <p className="lp-desc">{t("settings.automation.desc")}</p>

                    <div className="lp-field">
                      <span className="lp-label">{t("settings.automation.tokenLabel")}</span>
                      {newToken ? (
                        <>
                          <div className="lp-field-row">
                            <code className="lp-code">{newToken}</code>
                            <CopyButton text={newToken} label={t("settings.automation.copyToken")} />
                          </div>
                          <p className="lp-desc lp-warn">{t("settings.automation.tokenOnlyOnce")}</p>
                        </>
                      ) : (
                        <div className="lp-field-row">
                          <Button type="button" variant="outline" size="sm" onClick={generateToken}>
                            {t(token?.hasToken ? "settings.automation.regenerateToken" : "settings.automation.generateToken")}
                          </Button>
                          {token?.hasToken && (
                            <Button type="button" variant="ghost" size="sm" onClick={revokeToken}>
                              {t("settings.automation.revokeToken")}
                            </Button>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="lp-field">
                      <span className="lp-label">{t("settings.automation.endpointUrl")}</span>
                      <div className="lp-field-row">
                        <code className="lp-code">{endpointUrl || "..."}</code>
                        {endpointUrl && <CopyButton text={endpointUrl} label={t("settings.automation.copyUrl")} />}
                      </div>
                    </div>

                    <div className="lp-field">
                      <span className="lp-label">{t("settings.automation.requestBody")}</span>
                      <pre className="lp-code">
                        <code>{exampleBody}</code>
                      </pre>
                      <div>
                        <CopyButton text={exampleBody} label={t("settings.automation.copyBody")} />
                      </div>
                    </div>

                    <div className="lp-field">
                      <span className="lp-label">{t("settings.automation.accountsList")}</span>
                      {accounts.length === 0 ? (
                        <p className="lp-desc">{t("accounts.noAccounts")}</p>
                      ) : (
                        <ul className="lp-mini-list">
                          {accounts.map((acc) => (
                            <li key={acc.id}>
                              <span>{acc.name}</span>
                              <CopyButton text={acc.id} label={t("settings.automation.copyId")} ghost />
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

          <section className="lp-section">
            <SectionHead title={es ? "Sesión" : "Session"} />
            <div className="lp-card lp-group">
              <button type="button" className="lp-row lp-row--danger" onClick={() => setSignOutOpen(true)}>
                <span className="lp-icon" aria-hidden>
                  <LogOut className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{t("settings.signout")}</span>
                  </span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>

      <ConfirmSheet
        open={signOutOpen}
        onOpenChange={setSignOutOpen}
        icon={<LogOut />}
        title={t("settings.signoutConfirmTitle")}
        description={t("settings.signoutConfirmDesc")}
        confirmLabel={t("settings.signout")}
        onConfirm={signOut}
      />
    </div>
  );
}
