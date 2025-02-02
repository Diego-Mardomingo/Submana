import React, { useState } from "react";

import "../styles/CalendarBody.css";
import Day from "./Day";

export default function CalendarBody({ initialYear, initialMonth }) {
  // Estado local para el año y mes actuales
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);

  // Arrays estáticos
  const diasSemana = ["MON","TUE","WED","THU","FRY","SAT","SUN"];
  const meses = [
    "January","February","March","April","May","June",
    "July","August","September","October","November","December"
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

  function todayIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-home"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
    );
  }
  function anteriorIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg> 
    );
  }
  function siguienteIcon(){
    return(
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
    );
  }
  function newIcon(){
    return(
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-plus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
    );
  }
  function dashboardIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-presentation-analytics"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 12v-4" /><path d="M15 12v-2" /><path d="M12 12v-1" /><path d="M3 4h18" /><path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" /><path d="M12 16v4" /><path d="M9 20h6" /></svg>
    );
  }
  function mySubsIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="2"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-menu-3"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 6h10" /><path d="M4 12h16" /><path d="M7 12h13" /><path d="M4 18h10" /></svg>
    );
  }

  return (
    <div className="calendar_container">
      <nav className="options_btn">
        <ul>
          <li className="mySubs_btn">{mySubsIcon()}</li>
          {/* <li className="dashboard_btn" title="My Dashboard">{dashboardIcon()}</li> */}
          <li className="new_btn" onClick={ () =>{window.location.href = '/newsub';}} title="New sub">{newIcon()}</li>
        </ul>
      </nav>
      <header className="calendar_header">
        <div className="buttonsMonth">
          <button onClick={handlePrevMonth} className="anterior">
            {anteriorIcon()}
          </button>
          <button onClick={handleNextMonth} className="siguiente">
            {siguienteIcon()}
          </button>
          <button onClick={handleToday}>
            {todayIcon()}
          </button>
        </div>
        <div className="header_text">
          <p className="nombre_mes">{meses[month]}</p>
          <p className="año">{year}</p>
        </div>
          <div className="spent_container">
            <p className="spent_title">Monthly spent</p>
            <p className="spent_value">298.43€</p>
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
