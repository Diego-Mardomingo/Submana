"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";
import { Bell, CheckCircle2, ChevronRight, XCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useLang } from "@/hooks/useLang";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { useTranslations } from "@/lib/i18n/utils";

type Notification = {
  id: string;
  success: boolean;
  transaction_id: string | null;
  error_message: string | null;
  amount: number | null;
  description: string | null;
  created_at: string;
  accounts: { name: string; color: string | null } | null;
};

/** Log of transactions created through the automation endpoint. */
export default function NotificationsBody() {
  const lang = useLang();
  const t = useTranslations(lang);
  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api<Notification[]>("/api/notifications"),
  });

  return (
    <div className="page-container fade-in">
      <PageHeader icon={<Bell className="size-6" />} title={t("notifications.title")} subtitle={t("notifications.heroSubtitle")} />

      <ScrollArea className="h-[calc(100dvh-10rem)]">
        <div className="space-y-2 pb-6">
          {isLoading ? (
            <div className="flex items-center justify-center min-h-[12rem]">
              <Spinner className="size-8 text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <Card className="border-border">
              <CardContent className="py-5 px-4">
                <p className="text-muted-foreground text-center text-sm">{t("notifications.empty")}</p>
                <p className="text-muted-foreground text-center text-xs mt-1">{t("notifications.emptyDesc")}</p>
              </CardContent>
            </Card>
          ) : (
            notifications.map((n) => {
              const href = n.success && n.transaction_id ? `/transactions/edit/${n.transaction_id}?returnTo=/notifications` : null;
              const content = (
                <CardContent className="py-1.5 px-3 sm:px-4">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="shrink-0">
                      {n.success ? <CheckCircle2 className="size-5 text-green-600" aria-hidden /> : <XCircle className="size-5 text-destructive" aria-hidden />}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {format(new Date(n.created_at), "PPp", { locale: lang === "es" ? es : enUS })}
                    </span>
                  </div>
                  <h3 className={`text-base font-semibold w-full text-left break-words mb-1 ${n.success ? "" : "text-destructive"}`}>
                    {n.success ? n.description?.trim() || t("transactions.expense") : (n.error_message ?? "Unknown error")}
                  </h3>
                  {n.success && (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold tabular-nums bg-muted rounded-md px-2 py-0.5">-{formatCurrency(Number(n.amount ?? 0))}</span>
                      {n.accounts && (
                        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                          <span className="shrink-0 size-2 rounded-full" style={{ backgroundColor: n.accounts.color ?? "var(--muted-foreground)" }} aria-hidden />
                          <span className="text-sm text-muted-foreground truncate">{n.accounts.name}</span>
                        </div>
                      )}
                    </div>
                  )}
                  {href && (
                    <div className="flex justify-end mt-1">
                      <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                        {t("notifications.viewTransaction")}
                        <ChevronRight className="size-3.5" />
                      </span>
                    </div>
                  )}
                </CardContent>
              );
              return href ? (
                <Link key={n.id} href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
                  <Card className="border-border py-0 gap-0 transition-colors hover:bg-muted/40 active:bg-muted/60">{content}</Card>
                </Link>
              ) : (
                <Card key={n.id} className="border-border py-0 gap-0">
                  {content}
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
