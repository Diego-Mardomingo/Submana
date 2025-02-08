import React from "react";
import "../styles/Day.css";

/**
 * Componente Day para React.
 *
 * @param {object} props
 * @param {number|string} props.dayNumber  - Número del día (se convertirá a número)
 * @param {object} [props.dayStyle]        - Objeto de estilos en React (opcional)
 *                                          Por ejemplo: { gridColumnStart: 3 }
 */
export default function Day({ dayNumber, dayStyle, isToday, icons = [] }) {
  const dayNum = dayNumber.toString().padStart(2, '0');

  const renderIcons = () => {
    if (icons.length > 4) {
      return (
        <>
          {icons.slice(0, 3).map((iconUrl, idx) => (
            <img
              key={idx}
              src={iconUrl}
              alt="subscription icon"
              className="subscription_icon"
            />
          ))}
          <div className="subscription_overflow">
            +{icons.length - 3}
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

  return (
    <div
      className={`dia ${isToday ? "diaActual" : ""}`}
      style={dayStyle}
    >
      <div className="icons_container">
        {renderIcons()}
      </div>
      <div className="number">{dayNum}</div>
    </div>
  );
}
