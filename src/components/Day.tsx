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
  isActive?: boolean;
  onDayClick?: (dayNumber: number) => void;
}

export default function Day({
  dayNumber,
  dayStyle,
  isToday,
  icons,
  subsForDay,
  transactions,
  isActive,
  onDayClick,
}: DayProps) {
  const dayNum = dayNumber.toString().padStart(2, "0");
  const hasSubscriptions = subsForDay.length > 0;
  const hasTransactions = transactions.length > 0;
  const isClickable = (hasSubscriptions || hasTransactions) && onDayClick;

  const hasIncome = transactions.some((t) => t.type === "income");
  const hasExpense = transactions.some((t) => t.type === "expense");

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
        isClickable && "hasSubs",
        isActive && "diaActive"
      )}
      style={dayStyle}
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
      {hasTransactions && (
        <div className="tx-indicator" aria-hidden>
          {hasIncome && <span className="tx-dot tx-dot-income" />}
          {hasExpense && <span className="tx-dot tx-dot-expense" />}
        </div>
      )}
      <div className="icons_container">{renderIcons()}</div>
      <div className="number">{dayNum}</div>
    </div>
  );
}
