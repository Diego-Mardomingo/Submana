import React, { useState, useEffect } from "react";
import "../styles/Day.css";

export default function Day({ dayNumber, dayStyle, isToday, icons = [], subsForDay = [],activeDay, setActiveDay,}) {
  const dayNum = dayNumber.toString().padStart(2, "0");
  const showPopup = activeDay === dayNumber;
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
        />
      ));
    }
  };

  function getFrequencyText(frequency){
    if(frequency === 'monthly'){
      return 'month/s';
    }else if(frequency === 'weekly'){
      return 'week/s';
    }else if(frequency === 'yearly'){
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

  // Manejadores para escritorio y móviles
  const handleMouseEnter = () => setActiveDay(prev => (prev === dayNumber ? null : dayNumber));
  const handleMouseLeave = () => setActiveDay(null);
  const handleClick = () => setActiveDay(prev => (prev === dayNumber ? null : dayNumber));

  return (
      <div
        className={`dia ${isToday ? "diaActual" : ""}${subsForDay.length > 0 ? "hasSubs" : ""}`}
        style={dayStyle}
        {...(!isTouchDevice ? { onMouseEnter: handleMouseEnter, onMouseLeave: handleMouseLeave } : {})}
        onClick={handleClick}
      >
        <div className="icons_container">
          {renderIcons()}
        </div>
        <div className="number">{dayNum}</div>
        {showPopup && subsForDay.length > 0 && (
          <div className="popup">
            <h3>Subscriptions day {dayNumber}</h3>
            {renderPopupContent()}
          </div>
        )}
      </div>
  );
}
