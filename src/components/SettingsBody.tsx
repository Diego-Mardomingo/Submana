"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, EyeOff, Languages, LogOut, Monitor, Moon, Palette, Sun, UserRound } from "lucide-react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { HandleSetup } from "@/components/HandleSetup";
import { CompactPageHeader } from "@/components/PageHeader";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { NotificationSettingsSection } from "@/components/notifications/NotificationSettingsSection";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setCalendarDotsOnly, useCalendarDotsOnly } from "@/hooks/useCalendarDots";
import { setLang, useLang } from "@/hooks/useLang";
import { setPrivacyMode, usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useProfile } from "@/hooks/useProfile";
import { createClientStore } from "@/lib/clientStore";
import { useTranslations } from "@/lib/i18n/utils";
import { disablePushOnThisDevice } from "@/lib/push/client";
import { toast } from "@/lib/toast";
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
  const calendarDotsOnly = useCalendarDotsOnly();
  const { data: profile } = useProfile();
  const { data: user, isLoading } = useQuery({ queryKey: ["user"], queryFn: async () => (await createClient().auth.getUser()).data.user });
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  // Avoid animating the theme slider from its server position on first paint.
  const [sliderReady, setSliderReady] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => requestAnimationFrame(() => setSliderReady(true)));
    return () => cancelAnimationFrame(frame);
  }, []);

  const signOut = async () => {
    // While still signed in: this device must stop getting this account's push.
    await disablePushOnThisDevice();
    const { error } = await createClient().auth.signOut();
    if (error) {
      toast.error(t("settings.signoutError"));
      return;
    }
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

  const name = user?.user_metadata?.name as string | undefined;

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
            <SectionHead title={t("profile.title")} />
            <Collapsible open={profileOpen} onOpenChange={setProfileOpen} className="lp-card lp-group">
              <CollapsibleTrigger className="lp-row">
                <span className="lp-icon" aria-hidden>
                  <UserRound className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{profile ? profile.display_name : t("profile.setup.title")}</span>
                  </span>
                  <span className="lp-meta">
                    <span className="lp-truncate">{profile ? "@" + profile.handle : t("profile.settings.desc")}</span>
                  </span>
                </span>
                <ChevronDown className="lp-chevron size-4" />
              </CollapsibleTrigger>
              <CollapsibleContent className="subs-collapsible-content">
                <div className="subs-collapsible-inner">
                  <div className="lp-panel">
                    <HandleSetup key={profile?.handle ?? "new"} profile={profile} showIntro={false} onDone={() => setProfileOpen(false)} />
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </section>

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

              <label className="lp-row lp-pref">
                <span className="lp-icon" aria-hidden>
                  <CalendarDays className="size-5" />
                </span>
                <span className="lp-main">
                  <span className="lp-title">
                    <span>{t("settings.calendarDotsOnly")}</span>
                  </span>
                  <span className="lp-desc">{t("settings.calendarDotsOnlyDesc")}</span>
                </span>
                <Switch className="lp-pref-control" checked={calendarDotsOnly} onCheckedChange={setCalendarDotsOnly} aria-label={t("settings.calendarDotsOnly")} />
              </label>
            </div>
          </section>

          <NotificationSettingsSection />

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
