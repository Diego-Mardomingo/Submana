import React, { useState, useEffect } from "react";

import "../styles/CalendarBody.css";
import Day from "./Day";

export default function CalendarBody({ initialYear, initialMonth }) {
  // Estado local para el año y mes actuales
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [subscriptions, setSubscriptions] = useState([]);

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

  useEffect(() => {
    const fetchSubs = async () => {
      try {
        const response = await fetch("/api/crud/getAllSubs");
        if (!response.ok) {
          throw new Error(`Error fetching subs: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success && data.subscriptions) {
          setSubscriptions(data.subscriptions);
        } else {
          console.error("No subscriptions in data:", data);
        }
      } catch (error) {
        console.error("Error fetching subs:", error);
      }
    };
    fetchSubs();
  }, []);

  function isPaymentDay(sub, year, month, dayNumber) {

    const current = new Date(year, month, dayNumber);
    // Parsear la fecha de inicio
    const start = new Date(sub.start_date);  // Ojo: "2025-02-13" => mes 1 en JS
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const startDay = start.getDate();

    // Si hay end_date, verificar si la suscripción ya acabó
    if (sub.end_date) {
      const end = new Date(sub.end_date);
      // Si la fecha (year,month) es posterior al fin, no se paga
      if (year > end.getFullYear() || (year === end.getFullYear() && month > end.getMonth())) {
        return null;
      }
    }

    // Calcular diferencia en meses desde el start_date hasta (year,month)
    const diffMonths = (year - startYear) * 12 + (month - startMonth);

    // Si diffMonths < 0 => este mes es antes del start => no se paga
    if (diffMonths < 0) {
      return null;
    }

    const msInDay = 1000 * 60 * 60 * 24;
    const diffDays = Math.floor((current - start) / msInDay);

    // Dependiendo de la frecuencia...
    switch (sub.frequency) {
      case "weekly": {
        // Cada 'frequency_value' semanas => 7 * frequency_value días
        const interval = 7 * (sub.frequency_value || 1);
        return diffDays % interval === 0;
      }
      case "monthly": {

        const diffMonths = (year - startYear) * 12 + (month - startMonth);
        if (diffMonths < 0) return false; // antes de empezar
        // Solo paga si diffMonths es múltiplo de frequency_value
        if (diffMonths % (sub.frequency_value || 1) === 0) {
          // Y si el 'dayNumber' coincide con el 'startDay'
          return dayNumber === startDay;
        }
        return false;
      }
      case "yearly": {

        const diffYears = year - startYear;
        if (diffYears < 0) return false; // antes de empezar
        // Comprobamos si es múltiplo de frequency_value
        if (diffYears % (sub.frequency_value || 1) === 0) {
          // Y si este mes y día coinciden con el start
          if (month === startMonth && dayNumber === startDay) {
            return true;
          }
        }
        return false;
      }
      default:
        // Si hay otras frecuencias (ej. "one-shot"), implementa aquí.
        return false;
    }
  }

  /**
   * Retorna un array de icon URLs para las suscripciones que se pagan en (dayNumber).
   */
  function getSubsIconsForDay(dayNumber) {
    return subscriptions.flatMap((sub) => {
      if (isPaymentDay(sub, year, month, dayNumber)) {
        return [sub.icon]; // sub.icon es la URL de la imagen
      }
      return [];
    });
  }

  function getSpentValue(){
    let spent = 0;
    subscriptions.forEach(sub => {
      const payDay = isPaymentDay(sub, year, month);
      if(payDay !== null){
        spent += sub.cost;
      }
    });
    return spent;
  }

  function todayIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-home"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l-2 0l9 -9l9 9l-2 0" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2 -2v-7" /><path d="M9 21v-6a2 2 0 0 1 2 -2h2a2 2 0 0 1 2 2v6" /></svg>
    );
  }
  function anteriorIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-left"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M15 6l-6 6l6 6" /></svg> 
    );
  }
  function siguienteIcon(){
    return(
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>
    );
  }
  function newIcon(){
    return(
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-plus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 5l0 14" /><path d="M5 12l14 0" /></svg>
    );
  }
  function dashboardIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-presentation-analytics"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 12v-4" /><path d="M15 12v-2" /><path d="M12 12v-1" /><path d="M3 4h18" /><path d="M4 4v10a2 2 0 0 0 2 2h12a2 2 0 0 0 2 -2v-10" /><path d="M12 16v4" /><path d="M9 20h6" /></svg>
    );
  }
  function mySubsIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-menu-3"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M10 6h10" /><path d="M4 12h16" /><path d="M7 12h13" /><path d="M4 18h10" /></svg>
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
            <p className="spent_title">Monthly spend</p>
            <p className="spent_value">{getSpentValue()}€</p>
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
              icons={getSubsIconsForDay(dayNumber)}
              dayNumber={dayNumber}
              dayStyle={styleObj}
            />
          );
        })}
      </section>
    </div>
  );
}
