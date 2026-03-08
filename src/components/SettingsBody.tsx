"use client";

import { useState, useEffect, useLayoutEffect } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { Sun, Moon, Monitor, LogOut } from "lucide-react";
import { Logo } from "@/components/Logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Switch } from "@/components/ui/switch";
import { useLangContext } from "@/contexts/LangContext";
import { usePrivacyMode } from "@/contexts/PrivacyModeContext";
import { useTranslations } from "@/lib/i18n/utils";
import { cn } from "@/lib/utils";

const COOKIE_THEME = "submana-theme";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getTheme(): Theme {
  if (typeof document === "undefined") return "system";
  return (localStorage.getItem(COOKIE_THEME) as Theme) || "system";
}

function getEffectiveTheme(theme: Theme): "light" | "dark" {
  return theme === "system" ? getSystemTheme() : theme;
}

export default function SettingsBody() {
  const { lang, setLang } = useLangContext();
  const { privacyModeEnabled, setPrivacyModeEnabled } = usePrivacyMode();
  const t = useTranslations(lang);
  const [supabase] = useState(() =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  );
  const [user, setUser] = useState<{
    email?: string;
    user_metadata?: { name?: string; avatar_url?: string };
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState<Theme>("system");
  const [sliderTransitionReady, setSliderTransitionReady] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  useLayoutEffect(() => {
    const t = getTheme();
    setTheme(t);
    document.documentElement.setAttribute("data-theme", getEffectiveTheme(t));
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSliderTransitionReady(true));
    });
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u ?? null);
      setLoading(false);
    });
  }, [supabase]);

  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      document.documentElement.setAttribute("data-theme", e.matches ? "dark" : "light");
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme);
    const effective = getEffectiveTheme(newTheme);
    document.documentElement.setAttribute("data-theme", effective);
    localStorage.setItem(COOKIE_THEME, newTheme);
    document.cookie = `${COOKIE_THEME}=${newTheme}; path=/; max-age=${60 * 60 * 24 * 365}`;
  };

  const handleLangChange = (newLang: "en" | "es") => {
    setLang(newLang);
  };

  const handleSignOutClick = () => setSignOutOpen(true);

  const handleSignOutConfirm = async () => {
    await supabase.auth.signOut();
    document.cookie = "sb-access-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    document.cookie = "sb-refresh-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    setSignOutOpen(false);
    window.location.href = "/login";
  };

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
            {loading ? (
              <div className="settings-profile-loading">
                <Skeleton className="h-20 w-20 rounded-full mx-auto mb-4" />
                <Skeleton className="h-6 w-40 mx-auto mb-2" />
                <Skeleton className="h-4 w-56 mx-auto" />
              </div>
            ) : (
              <div className="settings-profile">
                <Avatar className="settings-avatar">
                  {user?.user_metadata?.avatar_url ? (
                    <AvatarImage
                      src={user.user_metadata.avatar_url}
                      alt=""
                      referrerPolicy="no-referrer"
                    />
                  ) : null}
                  <AvatarFallback className="settings-avatar-fallback">
                    <span className="text-lg font-semibold">
                      {(user?.user_metadata?.name || user?.email || "?")
                        .charAt(0)
                        .toUpperCase()}
                    </span>
                  </AvatarFallback>
                </Avatar>
                <h2 className="settings-profile-name">
                  {user?.user_metadata?.name || "User"}
                </h2>
                <p className="settings-profile-email">{user?.email}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="settings-section-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="settings-section-title text-base">
              {t("settings.preferences")}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              {t("settings.preferencesDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="settings-setting-item">
              <Label className="settings-setting-label text-foreground font-semibold">
                {t("settings.theme")}
              </Label>
              <div
                className={cn(
                  "settings-theme-selector",
                  !sliderTransitionReady && "settings-theme-selector-no-transition"
                )}
                data-active={theme}
              >
                <div className="settings-theme-slider" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "settings-theme-btn flex-1",
                        theme === "light" && "settings-theme-btn-active"
                      )}
                      onClick={() => handleThemeChange("light")}
                    >
                      <Sun className="size-4" />
                      <span>{t("settings.theme.light")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("settings.theme.light")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "settings-theme-btn settings-theme-btn-system flex-1",
                        theme === "system" && "settings-theme-btn-active"
                      )}
                      onClick={() => handleThemeChange("system")}
                    >
                      <Monitor className="size-4" />
                      <span>{t("settings.theme.system")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("settings.theme.system")}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "settings-theme-btn flex-1",
                        theme === "dark" && "settings-theme-btn-active"
                      )}
                      onClick={() => handleThemeChange("dark")}
                    >
                      <Moon className="size-4" />
                      <span>{t("settings.theme.dark")}</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">{t("settings.theme.dark")}</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="settings-setting-item">
              <Label className="settings-setting-label text-foreground font-semibold">
                {t("settings.language")}
              </Label>
              <div
                className="settings-lang-selector"
                data-active={lang}
              >
                <div className="settings-lang-slider" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "settings-lang-btn flex-1",
                        lang === "en" && "settings-lang-btn-active"
                      )}
                      onClick={() => handleLangChange("en")}
                    >
                      <img
                        src="https://flagcdn.com/w40/us.png"
                        alt=""
                        className="settings-lang-flag"
                      />
                      <span>English</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">English</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className={cn(
                        "settings-lang-btn flex-1",
                        lang === "es" && "settings-lang-btn-active"
                      )}
                      onClick={() => handleLangChange("es")}
                    >
                      <img
                        src="https://flagcdn.com/w40/es.png"
                        alt=""
                        className="settings-lang-flag"
                      />
                      <span>Español</span>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="top">Español</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="settings-setting-item">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="settings-setting-label text-foreground font-semibold block">
                    {t("settings.privacyMode")}
                  </Label>
                  <p className="text-sm text-muted-foreground mt-2">
                    {t("settings.privacyModeDesc")}
                  </p>
                </div>
                <Switch
                  checked={privacyModeEnabled}
                  onCheckedChange={setPrivacyModeEnabled}
                  aria-label={t("settings.privacyMode")}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="settings-section-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="settings-section-title text-base">
              {t("settings.actions")}
            </CardTitle>
            <CardDescription className="text-muted-foreground text-sm">
              {t("settings.actionsDesc")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              className="settings-signout-btn w-full"
              onClick={handleSignOutClick}
            >
              <LogOut className="size-4" />
              <span>{t("settings.signout")}</span>
            </Button>
          </CardContent>
        </Card>
      </div>
      </ScrollArea>

      <Dialog open={signOutOpen} onOpenChange={setSignOutOpen}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>{t("settings.signoutConfirmTitle")}</DialogTitle>
            <DialogDescription>
              {t("settings.signoutConfirmDesc")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSignOutOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button variant="destructive" onClick={handleSignOutConfirm}>
              {t("settings.signout")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
