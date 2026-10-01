"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Copy, KeyRound, LogOut, Monitor, Moon, Sun } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useAccounts } from "@/hooks/useAccounts";
import { setLang, useLang } from "@/hooks/useLang";
import { setPrivacyMode, usePrivacyMode } from "@/hooks/usePrivacyMode";
import { api } from "@/lib/api";
import { createClientStore } from "@/lib/clientStore";
import type { UIKey } from "@/lib/i18n/ui";
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

export default function SettingsBody() {
  const lang = useLang();
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
  const section = (title: UIKey, description: UIKey, children: React.ReactNode) => (
    <Card className="settings-section-card border-border">
      <CardHeader className="pb-3">
        <CardTitle className="settings-section-title text-base">{t(title)}</CardTitle>
        <CardDescription className="text-muted-foreground text-sm">{t(description)}</CardDescription>
      </CardHeader>
      {children}
    </Card>
  );

  return (
    <div className="settings-page animate-in fade-in duration-300">
      <div className="settings-header">
        <Logo variant="settings" className="settings-logo-link" />
        <Separator className="settings-separator" />
      </div>

      <ScrollArea className="settings-scroll-area h-[calc(100dvh-12rem)]">
        <div className="settings-content">
          <Card className="settings-profile-card border-border">
            <CardContent className="pt-6 pb-6">
              {isLoading ? (
                <div className="settings-profile-loading">
                  <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
                  <Skeleton className="h-6 w-40 mx-auto mb-2" />
                  <Skeleton className="h-4 w-56 mx-auto" />
                </div>
              ) : (
                <div className="settings-profile">
                  <Avatar className="settings-avatar">
                    {user?.user_metadata?.avatar_url && <AvatarImage src={user.user_metadata.avatar_url} alt="" referrerPolicy="no-referrer" />}
                    <AvatarFallback className="settings-avatar-fallback">
                      <span className="text-lg font-semibold">{(name || user?.email || "?").charAt(0).toUpperCase()}</span>
                    </AvatarFallback>
                  </Avatar>
                  <h2 className="settings-profile-name">{name || "User"}</h2>
                  <p className="settings-profile-email">{user?.email}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {section(
            "settings.preferences",
            "settings.preferencesDesc",
            <CardContent className="space-y-6">
              <div className="settings-setting-item">
                <Label className="settings-setting-label text-foreground font-semibold">{t("settings.theme")}</Label>
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
              <div className="settings-setting-item">
                <Label className="settings-setting-label text-foreground font-semibold">{t("settings.language")}</Label>
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
              <div className="settings-setting-item">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label className="settings-setting-label text-foreground font-semibold block">{t("settings.privacyMode")}</Label>
                    <p className="text-sm text-muted-foreground mt-2">{t("settings.privacyModeDesc")}</p>
                  </div>
                  <Switch checked={privacyMode} onCheckedChange={setPrivacyMode} aria-label={t("settings.privacyMode")} />
                </div>
              </div>
            </CardContent>
          )}

          <Card className="settings-section-card border-border min-w-0 overflow-hidden">
            <Collapsible open={automationOpen} onOpenChange={setAutomationOpen}>
              <CollapsibleTrigger className="subs-collapsible-trigger w-full rounded-lg px-4 py-3 text-left hover:bg-muted/50 transition-colors min-w-0">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <KeyRound className="size-4 text-muted-foreground shrink-0" />
                    <span className="settings-section-title text-base font-medium break-words">{t("settings.automation.title")}</span>
                  </div>
                  <ChevronDown className={cn("size-4 text-muted-foreground shrink-0 transition-transform", automationOpen && "rotate-180")} />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardHeader className="pb-2 pt-4">
                  <CardDescription className="text-muted-foreground text-sm break-words">{t("settings.automation.desc")}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 pb-6 min-w-0">
                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">{t("settings.automation.tokenLabel")}</Label>
                    {newToken ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2 min-w-0">
                          <code className="flex-1 min-w-0 rounded bg-muted px-2 py-1.5 text-xs break-all">{newToken}</code>
                          <CopyButton text={newToken} label={t("settings.automation.copyToken")} />
                        </div>
                        <p className="text-xs text-muted-foreground">{t("settings.automation.tokenOnlyOnce")}</p>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={generateToken}>
                          {t(token?.hasToken ? "settings.automation.regenerateToken" : "settings.automation.generateToken")}
                        </Button>
                        {token?.hasToken && (
                          <>
                            <Button type="button" variant="ghost" size="sm" onClick={revokeToken}>
                              {t("settings.automation.revokeToken")}
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {token.lastUsedAt
                                ? `${t("settings.automation.lastUsed")} ${new Date(token.lastUsedAt).toLocaleString(lang === "es" ? "es-ES" : "en-US", { dateStyle: "short", timeStyle: "short" })}`
                                : t("settings.automation.tokenConfigured")}
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">{t("settings.automation.endpointUrl")}</Label>
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <code className="flex-1 min-w-0 rounded bg-muted px-2 py-1.5 text-xs break-all">{endpointUrl || "..."}</code>
                      {endpointUrl && <CopyButton text={endpointUrl} label={t("settings.automation.copyUrl")} />}
                    </div>
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">{t("settings.automation.requestBody")}</Label>
                    <div className="max-w-full rounded bg-muted overflow-hidden">
                      <pre className="rounded bg-muted p-3 text-xs max-w-full whitespace-pre-wrap break-all">
                        <code>{exampleBody}</code>
                      </pre>
                    </div>
                    <CopyButton text={exampleBody} label={t("settings.automation.copyBody")} />
                  </div>

                  <div className="space-y-2 min-w-0">
                    <Label className="text-sm font-medium">{t("settings.automation.accountsList")}</Label>
                    {accounts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">{t("accounts.noAccounts")}</p>
                    ) : (
                      <ul className="space-y-1.5 min-w-0">
                        {accounts.map((acc) => (
                          <li key={acc.id} className="flex items-center justify-between gap-2 rounded bg-muted/50 px-3 py-2 min-w-0">
                            <span className="text-sm truncate min-w-0">{acc.name}</span>
                            <CopyButton text={acc.id} label={t("settings.automation.copyId")} ghost />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {section(
            "settings.actions",
            "settings.actionsDesc",
            <CardContent>
              <Button variant="outline" className="settings-signout-btn w-full" onClick={() => setSignOutOpen(true)}>
                <LogOut className="size-4" />
                <span>{t("settings.signout")}</span>
              </Button>
            </CardContent>
          )}
        </div>
      </ScrollArea>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{t("settings.signoutConfirmTitle")}</DialogTitle>
            <DialogDescription>{t("settings.signoutConfirmDesc")}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={signOut}>
              {t("settings.signout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
