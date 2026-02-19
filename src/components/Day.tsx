"use client";

import { useState, useEffect } from "react";

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
  const showPopup = activeDay === dayNumber;
  const hasContent = subsForDay.length > 0 || transactions.length > 0;
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    setIsTouchDevice(
      "ontouchstart" in window || navigator.maxTouchPoints > 0
    );
  }, []);

  const renderIcons = () => {
    if (icons.length > 2) {
      return (
        <>
          {icons.slice(0, 1).map((iconUrl, idx) => (
            <img
              key={idx}
              src={iconUrl}
              alt="subscription icon"
              className="subscription_icon"
            />
          ))}
          <div className="subscription_overflow">+{icons.length - 1}</div>
        </>
      );
    }
    return icons.map((iconUrl, idx) => (
      <img
        key={idx}
        src={iconUrl}
        alt="subscription icon"
        className="subscription_icon"
      />
    ));
  };

  const handleEnter = () =>
    !isTouchDevice && setActiveDay(activeDay === dayNumber ? null : dayNumber);
  const handleLeave = () => !isTouchDevice && setActiveDay(null);
  const handleClick = () => setActiveDay(activeDay === dayNumber ? null : dayNumber);

  return (
    <div
      className={`dia ${isToday ? "diaActual" : ""}${hasContent ? " hasSubs" : ""}`}
      style={dayStyle}
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
      onClick={handleClick}
      onKeyDown={(e) => e.key === "Enter" && handleClick()}
      role={hasContent ? "button" : undefined}
      tabIndex={hasContent ? 0 : undefined}
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
      {showPopup && hasContent && (
        <div className="popup">
          <h3>Day {dayNumber}</h3>
          {subsForDay.length > 0 && (
            <div className="popup_content">
              {subsForDay.map((sub) => (
                <div key={sub.id} className="popup_item">
                  <img src={sub.icon} alt="" className="iconInfo" style={{ width: 30, height: 30, borderRadius: "50%" }} />
                  <div className="popup_header" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <strong>{sub.service_name}</strong>
                    <span>{sub.cost}€</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--gris-claro)" }}>
                      Every {sub.frequency_value} {getFrequencyText(sub.frequency)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
          {transactions.length > 0 && (
            <div style={{ marginTop: "0.5rem", borderTop: "1px solid var(--gris)", paddingTop: "0.5rem" }}>
              {transactions.map((tx) => (
                <div key={tx.id} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span>{tx.description || tx.category?.name || "Tx"}</span>
                  <span style={{ color: tx.type === "income" ? "var(--success)" : "var(--danger)", fontWeight: 700 }}>
                    {tx.type === "income" ? "+" : "-"}
                    {Number(tx.amount).toFixed(2)}€
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
