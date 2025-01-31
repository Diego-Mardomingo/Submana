import React, { useState } from "react";

import "../styles/CalendarBody.css";
import Day from "./Day";

export default function CalendarBody({ initialYear, initialMonth }) {
  // Estado local para el año y mes actuales
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  // Arrays estáticos
  const diasSemana = ["LUN","MAR","MIE","JUE","VIE","SAB","DOM"];
  const meses = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
  ];

  // Función que nos da el número de días en un mes dado
  function getDaysInMonth(y, m) {
    // new Date(año, mes+1, 0) => último día del mes
    // mes en JS va de 0 (Enero) a 11 (Diciembre)
    return new Date(y, m + 1, 0).getDate();
  }

  function getIsToday(actualDay){
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth();
    if(year === currentYear && month === currentMonth && actualDay === new Date().getDate()){
      return true;
    }
    return false;
  }

  // Calcula cuántos días hay en el mes actual
  const daysInMonth = getDaysInMonth(year, month);

  // Array [1..N] con los días
  const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Para posicionar el primer día en la rejilla
  // new Date(year, month, 1).getDay() => 0 = domingo, 1 = lunes, etc.
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  // Ajuste: si getDay() es 0 (domingo), queremos que sea la columna 7
  const startColumn = firstDayOfMonth === 0 ? 7 : firstDayOfMonth;

  // Handlers para cambiar de mes
  function handlePrevMonth() {
    let newMonth = month - 1;
    let newYear = year;
    if (newMonth < 0) {
      newMonth = 11;
      newYear = year - 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  }

  function handleNextMonth() {
    let newMonth = month + 1;
    let newYear = year;
    if (newMonth > 11) {
      newMonth = 0;
      newYear = year + 1;
    }
    setMonth(newMonth);
    setYear(newYear);
  }

  function handleToday(){
    let currentYear = new Date().getFullYear();
    let currentMonth = new Date().getMonth();
    setMonth(currentMonth);
    setYear(currentYear);
  }

  return (
    <div className="calendar_container">
      {/* Header con botones y nombre del mes/año */}
      <header className="calendar_header">
        <div className="buttonsMonth">
          <button onClick={handlePrevMonth} className="anterior">
            <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M5 12l6 6" /><path d="M5 12l6 -6" /></svg>
          </button>
          <button onClick={handleNextMonth} className="siguiente">
            <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-arrow-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
          </button>
          <button onClick={handleToday}>
            <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-home"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
          </button>
        </div>
        <div className="header_text">
          <p className="nombre_mes">{meses[month]}</p>
          <p className="año">{year}</p>
        </div>
      </header>

      {/* Sección del calendario */}
      <section className="calendar_body">
        {/* Días de la semana */}
        {diasSemana.map((dia) => (
          <div key={dia} className="diaSemana">
            {dia}
          </div>
        ))}

        {/* Días del mes */}
        {daysArray.map((dayNumber, index) => {
          const styleObj = index === 0 ? { gridColumnStart: startColumn } : {};
          return (
            <Day
              key={dayNumber}
              isToday={getIsToday(dayNumber)}
              dayNumber={dayNumber}
              dayStyle={styleObj}
            />
          );
        })}
      </section>
    </div>
  );
}
