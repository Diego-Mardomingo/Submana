"use client";

import { Avatar, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface DayProps {
  dayNumber: number;
  dayStyle?: React.CSSProperties;
  isToday: boolean;
  subIcons: (string | null | undefined)[];
  transactions: { type: string }[];
  onDayClick: (dayNumber: number) => void;
}

const subIcon = (src: string | null | undefined, key: number) => (
  <Avatar key={key} className="subscription_icon shrink-0">
    <AvatarImage src={src ?? undefined} alt="subscription" />
  </Avatar>
);

/** Calendar cell: subscription icons plus income/expense tints; clickable when it has content. */
export default function Day({ dayNumber, dayStyle, isToday, subIcons, transactions, onDayClick }: DayProps) {
  const hasIncome = transactions.some((t) => t.type === "income");
  const hasExpense = transactions.some((t) => t.type === "expense");
  const isClickable = subIcons.length > 0 || transactions.length > 0;

  const tints = [
    hasIncome && `linear-gradient(90deg, rgba(var(--success-rgb), 0.04) 0%, rgba(var(--success-rgb), 0) ${hasExpense ? 50 : 100}%)`,
    hasExpense && `linear-gradient(90deg, rgba(var(--danger-rgb), 0) ${hasIncome ? 50 : 0}%, rgba(var(--danger-rgb), 0.04) 100%)`,
  ].filter(Boolean);
  const shadows = [
    hasIncome && "inset 8px 0 12px -4px rgba(var(--success-rgb), 0.03)",
    hasExpense && "inset -8px 0 12px -4px rgba(var(--danger-rgb), 0.03)",
  ].filter(Boolean);
  const click = () => isClickable && onDayClick(dayNumber);

  return (
    <div
      className={cn("dia", isToday && "diaActual", isClickable && "hasSubs")}
      style={{
        ...dayStyle,
        background: tints.length
          ? `${tints.join(", ")}, linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, transparent 50%, rgba(0, 0, 0, 0.03) 100%), var(--gris-oscuro)`
          : undefined,
        boxShadow: shadows.join(", ") || undefined,
      }}
      onClick={click}
      onKeyDown={(e) => e.key === "Enter" && click()}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={isClickable ? `Day ${dayNumber}, scroll to details` : `Day ${dayNumber}`}
    >
      {hasIncome && <span className="tx-dot tx-dot-tl" aria-hidden />}
      {hasExpense && <span className="tx-dot tx-dot-tr" aria-hidden />}
      <div className="dia_content">
        <div className="icons_container" style={{ viewTransitionName: `calendar-sub-icons-${dayNumber}` }}>
          {subIcons.length > 2 ? (
            <>
              {subIcon(subIcons[0], 0)}
              <Badge variant="secondary" className="subscription_overflow shrink-0">
                +{subIcons.length - 1}
              </Badge>
            </>
          ) : (
            subIcons.map(subIcon)
          )}
        </div>
        <span className="number">{String(dayNumber).padStart(2, "0")}</span>
      </div>
    </div>
  );
}
