"use client";

import { useEffect, useEffectEvent } from "react";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import { toast } from "@/lib/toast";

const ID = "connection";

/** Warns while the browser is offline and says when the connection is back (one toast, updated in place). Renders nothing. */
export function ConnectionToast() {
  const t = useTranslations(useLang());
  const goOffline = useEffectEvent(() => toast.warning(t("offline.title"), { id: ID, description: t("offline.desc"), duration: Infinity }));
  const goOnline = useEffectEvent(() => toast.info(t("online.title"), { id: ID }));

  useEffect(() => {
    if (!navigator.onLine) goOffline();
    window.addEventListener("offline", goOffline);
    window.addEventListener("online", goOnline);
    return () => {
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", goOnline);
    };
  }, []);

  return null;
}
