import React, { useState, useEffect } from "react";
import "../styles/Day.css";

export default function Day({ dayNumber, dayStyle, isToday, icons = [], subsForDay = [], transactions = [], activeDay, setActiveDay, }) {
  const dayNum = dayNumber.toString().padStart(2, "0");
  const showPopup = activeDay === dayNumber;
  const hasContent = subsForDay.length > 0 || transactions.length > 0;
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    // Detecta si es un dispositivo táctil
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
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
              style={{ viewTransitionName: `sub-icon-${subsForDay[idx]?.id}` }}
            />
          ))}
          <div className="subscription_overflow">
            +{icons.length - 1}
          </div>
        </>
      );
    } else {
      return icons.map((iconUrl, idx) => (
        <img
          key={idx}
          src={iconUrl}
          alt="subscription icon"
          className="subscription_icon"
          style={{ viewTransitionName: `sub-icon-${subsForDay[idx]?.id}` }}
        />
      ));
    }
  };

  function getFrequencyText(frequency) {
    if (frequency === 'monthly') {
      return 'month/s';
    } else if (frequency === 'weekly') {
      return 'week/s';
    } else if (frequency === 'yearly') {
      return 'year/s';
    }
  }

  const renderPopupContent = () => (
    <div className="popup_content">
      {subsForDay.map((sub, idx) => (
        <div key={idx} className="popup_item">
          <img src={sub.icon} alt="subscription icon" className="iconInfo" />
          <div className="popup_header">
            <strong className="nameInfo texto-largo">{sub.service_name}</strong>
            <p className="costInfo">{sub.cost}€</p>
          </div>
          {/* <p>Start: {getFormatedDate(sub.start_date)}</p>
          {sub.end_date && <p>End: {getFormatedDate(sub.end_date)}</p>} */}
          <p className="frequencyInfo">Every {sub.frequency_value} {getFrequencyText(sub.frequency)}</p>
        </div>
      ))}
    </div>
  );

  const renderTransactionDots = () => {
    if (transactions.length === 0) return null;

    const dots = transactions.map((tx, idx) => (
      <div
        key={`dot-${idx}`}
        className={`tx-dot ${tx.type}`}
        style={{
          backgroundColor: tx.type === 'income' ? 'var(--verde)' : 'var(--rojo)',
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          margin: '0 2px'
        }}
      />
    ));

    return <div className="tx-dots-container" style={{ display: 'flex', justifyContent: 'center', marginTop: '4px' }}>{dots}</div>;
  };

  const renderTxPopupContent = () => (
    <div className="popup_tx_list" style={{ marginTop: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '0.5rem' }}>
      {transactions.map((tx, idx) => (
        <div key={idx} className="tx-popup-item" style={{ fontSize: '0.75rem', marginBottom: '8px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
            <span style={{ color: 'var(--blanco)', fontWeight: '600' }}>{tx.description || tx.category?.name || 'Tx'}</span>
            <span style={{ color: tx.type === 'income' ? 'var(--verde)' : 'var(--rojo)', fontWeight: 'bold' }}>
              {tx.type === 'income' ? '+' : '-'}{parseFloat(tx.amount).toFixed(2)}€
            </span>
          </div>
          {(tx.category || tx.subcategory) && (
            <div style={{ fontSize: '0.65rem', color: 'var(--gris-claro)', display: 'flex', alignItems: 'center', gap: '4px' }}>
              {tx.category && <span>{tx.category.name}</span>}
              {tx.category && tx.subcategory && <span>•</span>}
              {tx.subcategory && <span>{tx.subcategory.name}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );

  // Manejadores para escritorio y móviles
  const handleMouseEnter = () => setActiveDay(prev => (prev === dayNumber ? null : dayNumber));
  const handleMouseLeave = () => setActiveDay(null);
  const handleClick = () => setActiveDay(prev => (prev === dayNumber ? null : dayNumber));

  return (
    <div
      className={`dia ${isToday ? "diaActual" : ""}${hasContent ? " hasSubs" : ""}`}
      style={dayStyle}
      {...(!isTouchDevice ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave } : {})}
      onClick={handleClick}
    >
      <div className="icons_container">
        {renderIcons()}
      </div>
      {renderTransactionDots()}
      <div className="number">{dayNum}</div>
      {showPopup && hasContent && (
        <div className="popup">
          <h3>Day {dayNumber}</h3>
          {(subsForDay.length > 0) && renderPopupContent()}
          {(transactions.length > 0) && renderTxPopupContent()}
        </div>
      )}
    </div>
  );
}
