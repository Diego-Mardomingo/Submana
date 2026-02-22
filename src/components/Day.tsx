"use client";

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
  onDayClick?: (dayNumber: number) => void;
  incomeWeight?: number;
  expenseWeight?: number;
}

export default function Day({
  dayNumber,
  dayStyle,
  isToday,
  icons,
  subsForDay,
  transactions,
  onDayClick,
  incomeWeight = 0,
  expenseWeight = 0,
}: DayProps) {
  const dayNum = dayNumber.toString().padStart(2, "0");
  const hasSubscriptions = subsForDay.length > 0;
  const hasTransactions = transactions.length > 0;
  const isClickable = (hasSubscriptions || hasTransactions) && onDayClick;

  const hasIncome = transactions.some((t) => t.type === "income");
  const hasExpense = transactions.some((t) => t.type === "expense");

  const incomeScale = 0.75 + incomeWeight * 0.8;
  const expenseScale = 0.75 + expenseWeight * 0.8;

  const incomeAlpha = 0.5 + incomeWeight * 0.5;
  const expenseAlpha = 0.5 + expenseWeight * 0.5;

  const incomeGlowAlpha = 0.3 + incomeWeight * 0.5;
  const expenseGlowAlpha = 0.3 + expenseWeight * 0.5;
  const incomeGlowSize = 4 + incomeWeight * 10;
  const expenseGlowSize = 4 + expenseWeight * 10;

  const getBgGradient = () => {
    if (hasIncome && hasExpense) {
      return `linear-gradient(90deg, rgba(var(--success-rgb), 0.12) 0%, rgba(var(--success-rgb), 0) 50%, rgba(var(--danger-rgb), 0) 50%, rgba(var(--danger-rgb), 0.12) 100%)`;
    }
    if (hasIncome) {
      return `linear-gradient(90deg, rgba(var(--success-rgb), 0.12) 0%, rgba(var(--success-rgb), 0) 100%)`;
    }
    if (hasExpense) {
      return `linear-gradient(90deg, rgba(var(--danger-rgb), 0) 0%, rgba(var(--danger-rgb), 0.12) 100%)`;
    }
    return undefined;
  };

  const bgGradient = getBgGradient();

  const innerShadow = (hasIncome || hasExpense) ? [
    hasIncome ? `inset 8px 0 12px -4px rgba(var(--success-rgb), 0.08)` : null,
    hasExpense ? `inset -8px 0 12px -4px rgba(var(--danger-rgb), 0.08)` : null,
  ].filter(Boolean).join(", ") : undefined;

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

  const handleClick = () => {
    if (isClickable && onDayClick) onDayClick(dayNumber);
  };

  return (
    <div
      className={cn(
        "dia",
        isToday && "diaActual",
        isClickable && "hasSubs"
      )}
      style={{
        ...dayStyle,
        background: bgGradient 
          ? `${bgGradient}, linear-gradient(145deg, rgba(255, 255, 255, 0.02) 0%, transparent 50%, rgba(0, 0, 0, 0.03) 100%), var(--gris-oscuro)`
          : undefined,
        boxShadow: innerShadow,
      }}
      onClick={handleClick}
      onKeyDown={(e) => isClickable && e.key === "Enter" && handleClick()}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      aria-label={
        isClickable
          ? `Day ${dayNumber}, scroll to details`
          : `Day ${dayNumber}`
      }
    >
      {hasIncome && (
        <span
          className="tx-dot tx-dot-tl"
          aria-hidden
          style={{
            backgroundColor: `rgba(var(--success-rgb), ${incomeAlpha})`,
            filter: `brightness(${0.85 + incomeWeight * 0.4})`,
            transform: `scale(${incomeScale})`,
            boxShadow: `0 0 ${incomeGlowSize}px rgba(var(--success-rgb), ${incomeGlowAlpha})`,
          }}
        />
      )}
      {hasExpense && (
        <span
          className="tx-dot tx-dot-tr"
          aria-hidden
          style={{
            backgroundColor: `rgba(var(--danger-rgb), ${expenseAlpha})`,
            filter: `brightness(${0.85 + expenseWeight * 0.4})`,
            transform: `scale(${expenseScale})`,
            boxShadow: `0 0 ${expenseGlowSize}px rgba(var(--danger-rgb), ${expenseGlowAlpha})`,
          }}
        />
      )}
      <div className="dia_content">
        <div className="icons_container">{renderIcons()}</div>
        <span className="number">{dayNum}</span>
      </div>
    </div>
  );
}
