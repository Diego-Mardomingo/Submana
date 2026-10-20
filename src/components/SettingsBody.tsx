"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AtSign, CalendarDays, Copy, EyeOff, Languages, LogOut, Mail, Monitor, Moon, Palette, Pencil, Sun } from "lucide-react";
import { ConfirmSheet } from "@/components/ConfirmSheet";
import { HandleSetup } from "@/components/HandleSetup";
import { CompactPageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { FeedbackSheet } from "@/components/FeedbackSheet";
import { NotificationSettingsSection, PushHideAmountsRow } from "@/components/notifications/NotificationSettingsSection";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import { Sheet, SheetBody } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { setCalendarDotsOnly, useCalendarDotsOnly } from "@/hooks/useCalendarDots";
import { setLang, useLang } from "@/hooks/useLang";
import { setPrivacyMode, usePrivacyMode } from "@/hooks/usePrivacyMode";
import { useProfile } from "@/hooks/useProfile";
import { createClientStore } from "@/lib/clientStore";
import { localeOf } from "@/lib/format";
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
  options: { value: T; label: string; icon?: React.ReactNode; className?: string }[];
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

const SectionHead = ({ title }: { title: string }) => (
  <div className="lp-section-head">
    <span className="lp-section-title">{title}</span>
  </div>
);

/** "c4708bb · 20 Oct 2026": the deployed build, so a bug report can say which version it was. */
function buildLabel(lang: string) {
  const commit = process.env.NEXT_PUBLIC_BUILD_COMMIT;
  const time = process.env.NEXT_PUBLIC_BUILD_TIME;
  const date = time ? new Date(time).toLocaleDateString(localeOf(lang), { day: "numeric", month: "short", year: "numeric" }) : "";
  return [commit, date].filter(Boolean).join(" · ");
}

/** The public profile friends see (Subcount, joint accounts): one compact row with "Edit". */
function IdentityCard({ onEdit }: { onEdit: () => void }) {
  const t = useTranslations(useLang());
  const { data: profile, isLoading } = useProfile();
  const { data: user } = useQuery({ queryKey: ["user"], queryFn: async () => (await createClient().auth.getUser()).data.user });

  if (isLoading) {
    return (
      <div className="lp-card pf-id" aria-hidden>
        <span className="skeleton block size-14 shrink-0 rounded-full" />
        <span className="flex flex-1 flex-col gap-2">
          <span className="skeleton block h-4 w-1/2" />
          <span className="skeleton block h-3 w-1/3" />
        </span>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="lp-card pf-id">
        <span className="pf-id-empty" aria-hidden>
          <AtSign className="size-6" />
        </span>
        <span className="pf-id-main">
          <span className="pf-id-name">{t("profile.setup.title")}</span>
          <span className="pf-id-hint">{t("profile.noProfileHint")}</span>
        </span>
        <button type="button" className="lp-chip pf-id-create" onClick={onEdit}>
          {t("profile.createShort")}
        </button>
      </div>
    );
  }

  const copyHandle = async () => {
    try {
      await navigator.clipboard.writeText(`@${profile.handle}`);
      toast(t("profile.handleCopied"), { icon: <Copy /> });
    } catch {
      // Clipboard blocked (permissions / insecure context): nothing to copy to.
    }
  };

  return (
    <div className="lp-card pf-id">
      <ProfileAvatar name={profile.display_name} url={profile.avatar_url ?? user?.user_metadata?.avatar_url} size={56} />
      <span className="pf-id-main">
        <span className="pf-id-name">{profile.display_name}</span>
        <button type="button" className="pf-handle" onClick={copyHandle} aria-label={`${t("profile.copyHandle")}: @${profile.handle}`}>
          @{profile.handle}
          <Copy className="size-3.5" aria-hidden />
        </button>
        <span className="pf-id-hint">{t("profile.seenByFriends")}</span>
      </span>
      <button type="button" className="pf-edit" onClick={onEdit} aria-label={t("profile.editTitle")}>
        <Pencil className="size-4" aria-hidden />
        <span className="pf-edit-label">{t("profile.edit")}</span>
      </button>
    </div>
  );
}

/**
 * My profile: who friends see (compact), then the settings most people use (appearance, privacy,
 * notifications) and the account. Design reference: docs/design/profile.html.
 */
export default function SettingsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const queryClient = useQueryClient();
  const theme = themeStore.useValue();
  const privacyMode = usePrivacyMode();
  const calendarDotsOnly = useCalendarDotsOnly();
  const { data: profile } = useProfile();
  const { data: user } = useQuery({ queryKey: ["user"], queryFn: async () => (await createClient().auth.getUser()).data.user });
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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

  const provider = user?.app_metadata?.provider as string | undefined;
  const build = buildLabel(lang);

  return (
    <div className="page-container lp-page fade-in">
      <div className="pf-page">
        <CompactPageHeader title={t("nav.settings")} />

        <div className="lp-sections">
          <IdentityCard onEdit={() => setEditOpen(true)} />

          <section className="lp-section">
            <SectionHead title={t("settings.appearance")} />
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
                  {/* Language names in their own language, no flags: a flag is a country, not a language. */}
                  <Segmented
                    kind="lang"
                    value={lang}
                    onChange={setLang}
                    options={[
                      { value: "en", label: "English" },
                      { value: "es", label: "Español" },
                    ]}
                  />
                </div>
              </div>
            </div>
          </section>

          <section className="lp-section">
            <SectionHead title={t("settings.privacy")} />
            <div className="lp-card lp-group">
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

              <PushHideAmountsRow />
            </div>
          </section>

          <div className="pf-split">
            <NotificationSettingsSection />

            <section className="lp-section">
              <SectionHead title={t("settings.account")} />
              <div className="lp-card lp-group">
                <div className="lp-row lp-row--static">
                  <span className="lp-icon" aria-hidden>
                    <Mail className="size-5" />
                  </span>
                  <span className="lp-main">
                    <span className="lp-title">
                      <span>{t("settings.email")}</span>
                    </span>
                    <span className="lp-meta">
                      <span className="lp-truncate">{user?.email ?? "…"}</span>
                    </span>
                  </span>
                  {provider && provider !== "email" && <span className="pf-provider">{provider.charAt(0).toUpperCase() + provider.slice(1)}</span>}
                </div>
                <button type="button" className="lp-row" onClick={() => setSignOutOpen(true)}>
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

          <footer className="pf-footer">
            <button type="button" onClick={() => setFeedbackOpen(true)}>
              {t("settings.feedback")}
            </button>
            {build && <span>Submana · {build}</span>}
          </footer>
        </div>
      </div>

      <Sheet open={editOpen} onOpenChange={setEditOpen} title={t(profile ? "profile.editTitle" : "profile.setup.title")}>
        <SheetBody>
          <HandleSetup key={profile?.handle ?? "new"} profile={profile} showIntro={false} showPreview onDone={() => setEditOpen(false)} />
        </SheetBody>
      </Sheet>
      <FeedbackSheet open={feedbackOpen} onOpenChange={setFeedbackOpen} />
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
