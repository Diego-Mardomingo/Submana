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
export default function Day({ dayNumber, dayStyle, isToday }) {
  // Asegúrate de convertir a número si `dayNumber` viene como string
  const dayNum = Number(dayNumber);

  // Comprueba si es el día actual
  // const isToday = dayNum === new Date().getDate();

  return (
    <div
      className={`dia ${isToday ? "diaActual" : ""}`}
      style={dayStyle}
    >
      <div className="number">{dayNum}</div>
    </div>
  );
}
