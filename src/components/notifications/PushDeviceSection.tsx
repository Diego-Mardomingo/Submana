"use client";

import { useCallback, useEffect, useState } from "react";
import { BellRing, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { apiErrorText } from "@/lib/apiErrorText";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";
import {
  getCurrentSubscription,
  getPermission,
  getPushRegistration,
  isIosNotStandalone,
  isPushSupported,
  registerSubscription,
  subscribeThisDevice,
  unsubscribeThisDevice,
} from "@/lib/push/client";

type Status = "loading" | "unsupported" | "ios" | "denied" | "off" | "on";

async function readStatus(): Promise<Status> {
  if (isIosNotStandalone()) return "ios";
  // Without a registered service worker (Serwist is disabled in dev: use `pnpm build && pnpm start`) there is no push.
  if (!isPushSupported() || !(await getPushRegistration())) return "unsupported";
  if (getPermission() === "denied") return "denied";
  const subscription = await getCurrentSubscription();
  if (!subscription || getPermission() !== "granted") return "off";
  // The browser is subscribed: make sure the server has it under this account (it may have been another one's).
  await registerSubscription(subscription).catch(() => {});
  return "on";
}

/**
 * "This device" row of the profile's Notifications section: push state, enable, send test, disable.
 * Renders one `lp-row`, so mount it inside an `lp-card lp-group`.
 */
export function PushDeviceSection() {
  const t = useTranslations(useLang());
  const [status, setStatus] = useState<Status>("loading");
  const [busy, setBusy] = useState<"enable" | "test" | "disable" | null>(null);

  const refresh = useCallback(() => {
    void readStatus().then(setStatus, () => setStatus("unsupported"));
  }, []);
  useEffect(() => {
    refresh();
    // The permission can change in the browser settings while the profile stays open.
    window.addEventListener("focus", refresh);
    return () => window.removeEventListener("focus", refresh);
  }, [refresh]);

  const fail = (error: unknown) => toast.error(t("push.error"), { description: apiErrorText(t, error) });

  const enable = async () => {
    setBusy("enable");
    try {
      const result = await subscribeThisDevice();
      if (result === "subscribed") toast.success(t("push.enabledToast"));
      else if (result === "unavailable") toast.error(t("push.error"), { description: t("push.unsupported") });
      refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const sendTest = async () => {
    setBusy("test");
    try {
      await api("/api/push/test", "POST");
      toast.success(t("push.testSent"));
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const disable = async () => {
    setBusy("disable");
    try {
      await unsubscribeThisDevice();
      toast(t("push.disabledToast"), { icon: <BellRing className="size-4" /> });
      refresh();
    } catch (error) {
      fail(error);
    } finally {
      setBusy(null);
    }
  };

  const description: Record<Status, string> = {
    loading: "",
    unsupported: t("push.unsupported"),
    ios: t("push.ios.steps"),
    denied: t("push.denied.help"),
    off: t("push.off"),
    on: t("push.enabled"),
  };
  const title = status === "ios" ? t("push.ios.title") : status === "denied" ? t("push.denied.title") : t("push.title");

  return (
    <div className={`lp-row lp-row--static lp-pref${status === "off" || status === "on" ? " lp-pref--stack" : ""}`}>
      <span className="lp-icon" aria-hidden>
        <Smartphone className="size-5" />
      </span>
      <span className="lp-main">
        <span className="lp-title">
          <span>{title}</span>
        </span>
        {description[status] && <span className="lp-desc">{description[status]}</span>}
      </span>
      {status === "off" && (
        <div className="lp-pref-control">
          <Button type="button" size="sm" onClick={enable} disabled={busy !== null}>
            {busy === "enable" ? t("push.enabling") : t("push.enable")}
          </Button>
        </div>
      )}
      {status === "on" && (
        <div className="lp-pref-control flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="outline" onClick={sendTest} disabled={busy !== null}>
            {t("push.sendTest")}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={disable} disabled={busy !== null}>
            {t("push.disable")}
          </Button>
        </div>
      )}
    </div>
  );
}
