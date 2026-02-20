"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Sub {
  id: string;
  service_name: string;
  icon: string;
  cost: number;
  frequency: string;
  frequency_value: number;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description?: string;
  category?: { name: string };
  subcategory?: { name: string };
}

interface DayProps {
  dayNumber: number;
  dayStyle?: React.CSSProperties;
  isToday: boolean;
  icons: string[];
  subsForDay: Sub[];
  transactions: Transaction[];
  activeDay: number | null;
  setActiveDay: (d: number | null) => void;
}

function getFrequencyText(freq: string) {
  if (freq === "monthly") return "month/s";
  if (freq === "weekly") return "week/s";
  if (freq === "yearly") return "year/s";
  return freq;
}

export default function Day({
  dayNumber,
  dayStyle,
  isToday,
  icons,
  subsForDay,
  transactions,
  activeDay,
  setActiveDay,
}: DayProps) {
  const dayNum = dayNumber.toString().padStart(2, "0");
  const hasSubscriptions = subsForDay.length > 0;
  const isClickable = hasSubscriptions;
  const showPopup = activeDay === dayNumber && isClickable;

  const renderIcons = () => {
    const iconList = icons ?? [];
    if (iconList.length > 2) {
      return (
        <>
          {iconList.slice(0, 1).map((iconUrl, idx) => {
            const subId = subsForDay[idx]?.id ?? idx;
            return (
              <Avatar
                key={idx}
                className="subscription_icon shrink-0"
                style={{ viewTransitionName: `sub-icon-${subId}-day-${dayNumber}` }}
              >
                <AvatarImage src={iconUrl} alt="subscription" />
              </Avatar>
            );
          })}
          <Badge variant="secondary" className="subscription_overflow shrink-0">
            +{iconList.length - 1}
          </Badge>
        </>
      );
    }
    return iconList.map((iconUrl, idx) => {
      const subId = subsForDay[idx]?.id ?? idx;
      return (
        <Avatar
          key={idx}
          className="subscription_icon shrink-0"
          style={{ viewTransitionName: `sub-icon-${subId}-day-${dayNumber}` }}
        >
          <AvatarImage src={iconUrl} alt="subscription" />
        </Avatar>
      );
    });
  };

  const handleClick = () => isClickable && setActiveDay(activeDay === dayNumber ? null : dayNumber);

  return (
    <div
      className={cn("dia", isToday && "diaActual", isClickable && "hasSubs")}
      style={dayStyle}
      onClick={handleClick}
      onKeyDown={(e) => isClickable && e.key === "Enter" && handleClick()}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      <div className="icons_container">{renderIcons()}</div>
      {transactions.length > 0 && (
        <div style={{ display: "flex", justifyContent: "center", marginTop: 4, gap: 4 }}>
          {transactions.slice(0, 3).map((tx, idx) => (
            <div
              key={idx}
              style={{
                width: 6,
                height: 6,
                borderRadius: "50%",
                backgroundColor: tx.type === "income" ? "var(--success)" : "var(--danger)",
              }}
            />
          ))}
        </div>
      )}
      <div className="number">{dayNum}</div>
      <Sheet open={showPopup} onOpenChange={(open) => !open && setActiveDay(null)}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl pb-[env(safe-area-inset-bottom)]"
          showCloseButton={true}
        >
          <SheetHeader>
            <SheetTitle className="text-primary">Day {dayNumber}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-4 overflow-y-auto max-h-[60vh]">
            {subsForDay.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {subsForDay.map((sub) => (
                  <Card key={sub.id} className="bg-muted/50 border-border">
                    <CardContent className="flex flex-row items-center gap-3 p-4">
                      <Avatar className="size-8 shrink-0">
                        <AvatarImage src={sub.icon} alt={sub.service_name} />
                      </Avatar>
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <strong className="text-sm truncate">{sub.service_name}</strong>
                        <span className="font-semibold">{sub.cost}€</span>
                        <span className="text-xs text-muted-foreground">
                          Every {sub.frequency_value} {getFrequencyText(sub.frequency)}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
            {transactions.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-border">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex justify-between items-center">
                    <span className="text-sm truncate">{tx.description || tx.category?.name || "Tx"}</span>
                    <span
                      className="font-bold text-sm shrink-0 ml-2"
                      style={{
                        color: tx.type === "income" ? "var(--success)" : "var(--danger)",
                      }}
                    >
                      {tx.type === "income" ? "+" : "-"}
                      {Number(tx.amount).toFixed(2)}€
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
