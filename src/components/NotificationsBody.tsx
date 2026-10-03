"use client";

import { Bell } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";

/** Placeholder until the notifications feature lands: nothing writes notifications yet. */
export default function NotificationsBody() {
  const t = useTranslations(useLang());

  return (
    <div className="page-container fade-in">
      <PageHeader icon={<Bell className="size-6" />} title={t("notifications.title")} subtitle={t("notifications.heroSubtitle")} />

      <Card className="border-border">
        <CardContent className="py-5 px-4">
          <p className="text-muted-foreground text-center text-sm">{t("notifications.empty")}</p>
          <p className="text-muted-foreground text-center text-xs mt-1">{t("notifications.emptyDesc")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
