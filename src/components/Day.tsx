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

  const incomeGlow = `0 0 ${4 + incomeWeight * 10}px rgba(34, 197, 94, ${0.3 + incomeWeight * 0.5})`;
  const expenseGlow = `0 0 ${4 + expenseWeight * 10}px rgba(239, 68, 68, ${0.3 + expenseWeight * 0.5})`;

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
      {hasIncome && (
        <span
          className="tx-dot tx-dot-income tx-dot-tl"
          aria-hidden
          style={{
            opacity: 0.6 + incomeWeight * 0.4,
            filter: `brightness(${0.85 + incomeWeight * 0.4})`,
            transform: `scale(${incomeScale})`,
            boxShadow: incomeGlow,
          }}
        />
      )}
      {hasExpense && (
        <span
          className="tx-dot tx-dot-expense tx-dot-tr"
          aria-hidden
          style={{
            opacity: 0.6 + expenseWeight * 0.4,
            filter: `brightness(${0.85 + expenseWeight * 0.4})`,
            transform: `scale(${expenseScale})`,
            boxShadow: expenseGlow,
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
