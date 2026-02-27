"use client";

import { useTranslations } from "@/lib/i18n/utils";
import { useLang } from "@/hooks/useLang";
import { Hand } from "lucide-react";

interface ChartMobileHintProps {
  type?: "tap" | "swipe";
}

export function ChartMobileHint({ type = "tap" }: ChartMobileHintProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  const message = type === "tap" 
    ? t("dashboard.tapToSeeDetails")
    : t("dashboard.swipeToChangePeriod");

  return (
    <div className="chart-touch-hint flex items-center justify-center gap-1.5">
      <Hand className="size-3" strokeWidth={1.5} />
      <span>{message}</span>
    </div>
  );
}
