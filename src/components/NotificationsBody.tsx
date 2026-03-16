"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLangContext } from "@/contexts/LangContext";
import { useTranslations } from "@/lib/i18n/utils";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, XCircle, Bell, ChevronRight } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { format } from "date-fns";
import { enUS, es } from "date-fns/locale";

type NotificationRow = {
  id: string;
  success: boolean;
  transaction_id: string | null;
  error_message: string | null;
  amount: number | null;
  description: string | null;
  account_id: string | null;
  created_at: string;
  accounts: { name: string; color: string | null } | null;
};

export default function NotificationsBody() {
  const { lang } = useLangContext();
  const t = useTranslations(lang);
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications")
      .then((r) => (r.ok ? r.json() : { data: [] }))
      .then((json: { data?: NotificationRow[] }) => {
        setNotifications(Array.isArray(json.data) ? json.data : []);
      })
      .catch(() => setNotifications([]))
      .finally(() => setLoading(false));
  }, []);

  const dateLocale = lang === "es" ? es : enUS;

  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <div className="page-header-icon">
            <Bell className="size-6" />
          </div>
          <div className="page-header-text">
            <h1>{t("notifications.title")}</h1>
            <p>{t("notifications.heroSubtitle")}</p>
          </div>
        </div>
      </header>

      <ScrollArea className="h-[calc(100dvh-10rem)]">
        <div className="space-y-2 pb-6">
          {loading ? (
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
              const href = n.success && n.transaction_id
                ? `/transactions/edit/${n.transaction_id}?returnTo=/notifications`
                : null;
              const dateStr = format(new Date(n.created_at), "PPp", { locale: dateLocale });
              const title = n.success
                ? (n.description?.trim() || t("transactions.expense"))
                : (n.error_message ?? "Unknown error");
              const accountColor = n.accounts?.color ?? "var(--muted-foreground)";

              const cardContent = (
                <CardContent className="py-1.5 px-3 sm:px-4">
                  {/* Fila superior: icono izquierda, fecha y hora derecha */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="shrink-0">
                      {n.success ? (
                        <CheckCircle2 className="size-5 text-green-600" aria-hidden />
                      ) : (
                        <XCircle className="size-5 text-destructive" aria-hidden />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{dateStr}</span>
                  </div>
                  {/* Título: descripción (o tipo/error) al 100% ancho, pegada a la izquierda */}
                  <h3 className={`text-base font-semibold w-full text-left break-words mb-1 ${!n.success ? "text-destructive" : ""}`}>
                    {title}
                  </h3>
                  {n.success ? (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="text-sm font-semibold tabular-nums bg-muted rounded-md px-2 py-0.5">
                        {-Number(n.amount ?? 0).toFixed(2)} €
                      </span>
                      {n.accounts?.name != null && (
                        <div className="flex items-center gap-1.5 shrink-0 min-w-0">
                          <span
                            className="shrink-0 size-2 rounded-full"
                            style={{ backgroundColor: accountColor }}
                            aria-hidden
                          />
                          <span className="text-sm text-muted-foreground truncate">{n.accounts.name}</span>
                        </div>
                      )}
                    </div>
                  ) : null}
                  {/* Esquina inferior derecha: Ver transacción */}
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

              if (href) {
                return (
                  <Link key={n.id} href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-xl">
                    <Card className="border-border py-0 gap-0 transition-colors hover:bg-muted/40 active:bg-muted/60">
                      {cardContent}
                    </Card>
                  </Link>
                );
              }

              return (
                <Card key={n.id} className="border-border py-0 gap-0">
                  {cardContent}
                </Card>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
