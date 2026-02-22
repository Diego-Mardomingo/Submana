"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useLang } from "@/hooks/useLang";
import { useTranslations } from "@/lib/i18n/utils";
import {
  TrendingUp,
  TrendingDown,
  Repeat,
} from "lucide-react";

const formatCurrency = (n: number) => {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true,
  }).format(n);
  return `${formatted} €`;
};

export type SubForList = {
  id: string;
  service_name: string;
  icon?: string | null;
  cost: number | string;
  frequency: string;
  frequency_value?: number;
};

export type TxForList = {
  id: string;
  amount: number;
  type: string;
  description?: string | null;
  category?: { name: string } | null;
  subcategory?: { name: string } | null;
};

export type DayEntry = {
  dayNumber: number;
  isToday: boolean;
  subs: SubForList[];
  transactions: TxForList[];
};

interface CalendarDayListProps {
  dayEntries: DayEntry[];
  year: number;
  month: number;
}

function getFrequencyText(freq: string) {
  if (freq === "monthly") return "month/s";
  if (freq === "weekly") return "week/s";
  if (freq === "yearly") return "year/s";
  return freq;
}

function formatDateLabel(date: Date, lang: string) {
  return date.toLocaleDateString(lang === "es" ? "es-ES" : "en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

export default function CalendarDayList({
  dayEntries,
  year,
  month,
}: CalendarDayListProps) {
  const lang = useLang();
  const t = useTranslations(lang);

  if (dayEntries.length === 0) {
    return (
      <div className="calendar-day-list">
        <div className="calendar-day-list-empty">
          <p>{t("calendar.no_activity_this_month")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="calendar-day-list">
      <div className="calendar-day-list-scroll">
        <div className="calendar-day-list-inner">
        {dayEntries.map((entry) => {
          const date = new Date(year, month, entry.dayNumber);
          const label = formatDateLabel(date, lang);
          const hasContent = entry.subs.length > 0 || entry.transactions.length > 0;
          if (!hasContent) return null;

          return (
            <section
              key={entry.dayNumber}
              id={`calendar-day-${entry.dayNumber}`}
              className={cn(
                "calendar-day-section",
                entry.isToday && "calendar-day-section-today"
              )}
              data-day={entry.dayNumber}
              style={{ scrollMarginTop: "1.5rem" }}
            >
              <h3 className="calendar-day-header">
                <span className="calendar-day-header-label">{label}</span>
                {entry.isToday && (
                  <span className="calendar-day-header-badge">
                    {t("calendar.today")}
                  </span>
                )}
              </h3>

              <div className="calendar-day-items">
                {entry.subs.map((sub) => (
                  <Card
                    key={`sub-${sub.id}-${entry.dayNumber}`}
                    className="calendar-day-card calendar-day-card-sub"
                  >
                    <CardContent className="calendar-day-card-content">
                      <Avatar className="calendar-day-avatar shrink-0">
                        {sub.icon ? (
                          <AvatarImage src={sub.icon} alt={sub.service_name} />
                        ) : (
                          <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                            {(sub.service_name || "?").charAt(0).toUpperCase()}
                          </AvatarFallback>
                        )}
                      </Avatar>
                      <div className="calendar-day-card-body min-w-0 flex-1">
                        <span className="calendar-day-card-title truncate block">
                          {sub.service_name}
                        </span>
                        <span className="calendar-day-card-meta">
                          <Repeat className="calendar-day-card-meta-icon" />
                          Every {sub.frequency_value ?? 1}{" "}
                          {getFrequencyText(sub.frequency)}
                        </span>
                      </div>
                      <span className="calendar-day-card-amount calendar-day-card-amount-expense shrink-0">
                        -{formatCurrency(Number(sub.cost))}
                      </span>
                    </CardContent>
                  </Card>
                ))}

                {entry.transactions.map((tx) => (
                  <Card
                    key={tx.id}
                    className="calendar-day-card calendar-day-card-tx"
                  >
                    <CardContent className="calendar-day-card-content">
                      <div
                        className={cn(
                          "calendar-day-tx-icon shrink-0",
                          tx.type === "income"
                            ? "calendar-day-tx-icon-income"
                            : "calendar-day-tx-icon-expense"
                        )}
                      >
                        {tx.type === "income" ? (
                          <TrendingUp className="size-3.5" strokeWidth={2.5} />
                        ) : (
                          <TrendingDown className="size-3.5" strokeWidth={2.5} />
                        )}
                      </div>
                      <div className="calendar-day-card-body min-w-0 flex-1">
                        <span className="calendar-day-card-title truncate block">
                          {tx.description || tx.category?.name || "Transaction"}
                        </span>
                        {tx.category && (
                          <span className="calendar-day-card-meta">
                            {tx.category.name}
                            {tx.subcategory && ` · ${tx.subcategory.name}`}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "calendar-day-card-amount shrink-0 font-semibold",
                          tx.type === "income"
                            ? "calendar-day-card-amount-income"
                            : "calendar-day-card-amount-expense"
                        )}
                      >
                        {tx.type === "income" ? "+" : "-"}
                        {formatCurrency(Number(tx.amount))}
                      </span>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          );
        })}
        </div>
      </div>
    </div>
  );
}
