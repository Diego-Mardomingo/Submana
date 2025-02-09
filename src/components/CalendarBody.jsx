import React, { useState, useEffect } from "react";
import LoadingSpinner from "./LoadingSpinner";
import "../styles/CalendarBody.css";
import Day from "./Day";

export default function CalendarBody({ initialYear, initialMonth }) {
  // Estado local para el año y mes actuales
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(initialMonth);
  const [subscriptions, setSubscriptions] = useState([]);
  const [isLoading, setLoading] = useState([]);


  // ? SWIPE FUNCIONALITY
  const [touchStartX, setTouchStartX] = useState(null);
  const [touchStartY, setTouchStartY] = useState(null);
  const [touchEndX, setTouchEndX] = useState(null);
  const [touchEndY, setTouchEndY] = useState(null);

  const minSwipeDistance = 50; // distancia mínima en píxeles para considerar el swipe

  const onTouchStart = (e) => {
    setTouchEndX(null); // reiniciamos el final
    setTouchEndY(null);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };
  
  const onTouchMove = (e) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };
  
  const onTouchEnd = () => {
    if (touchStartX === null || touchStartY === null || touchEndX === null || touchEndY === null) return;
    const deltaX = touchStartX - touchEndX;
    const deltaY = touchStartY - touchEndY;
  
    // Determinar si el swipe es mayor en horizontal o vertical
    if (Math.abs(deltaX) > Math.abs(deltaY)) {
      // Swipe horizontal
      if (deltaX > minSwipeDistance) {
        // Desliza a la izquierda: avanzar mes
        handleNextMonth();
      } else if (deltaX < -minSwipeDistance) {
        // Desliza a la derecha: retroceder mes
        handlePrevMonth();
      }
    } else {
      // Swipe vertical
      // Si se desliza de abajo hacia arriba, deltaY será positivo
      if (deltaY > minSwipeDistance) {
        // Swipe vertical (bottom-to-top): ir a hoy
        handleToday();
      }
    }
    // Reiniciamos las coordenadas para el próximo toque
    setTouchStartX(null);
    setTouchStartY(null);
    setTouchEndX(null);
    setTouchEndY(null);
  };
  
  
  // ? END SWIPE FUNCIONALITY

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
    setLoading(true);
    const fetchSubs = async () => {
      try {
        const response = await fetch("/api/crud/getAllSubs");
        if (!response.ok) {
          throw new Error(`Error fetching subs: ${response.statusText}`);
        }
        const data = await response.json();
        if (data.success && data.subscriptions) {
          setSubscriptions(data.subscriptions);
          setLoading(false);
        } else {
          console.error("No subscriptions in data:", data);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching subs:", error);
        setLoading(false);
      }
    };
    fetchSubs();
  }, []);

  function setToNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }

  function isPaymentDay(sub, year, month, dayNumber) {

    const current = setToNoon(new Date(year, month, dayNumber));
    // Parsear la fecha de inicio
    const start = setToNoon(new Date(sub.start_date));
    const startYear = start.getFullYear();
    const startMonth = start.getMonth();
    const startDay = start.getDate();
    // start = new Date(startYear, startMonth, startDay);
    if(start > current){
      return null;
    }

    if(sub.end_date){
      const end = setToNoon(new Date(sub.end_date));
      // const endYear = end.getFullYear();
      // const endMonth = end.getMonth();
      // const endDay = end.getDate();
      // end = new Date(endYear, endMonth, endDay);
      if(end < current){
        return null;
      }
    }
    

    
    // Dependiendo de la frecuencia...
    switch (sub.frequency) {
      case "weekly": {
        const msInDay = 1000 * 60 * 60 * 24;
        const diffDays = Math.round((current - start) / msInDay);
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
    daysArray.map((dayNumber) => {
      subscriptions.forEach(sub => {
        if(isPaymentDay(sub, year, month, dayNumber)){
          spent = parseFloat((spent + sub.cost).toFixed(2));
        }
      });
    });
    return spent;
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
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-cloud-plus"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12 18.004h-5.343c-2.572 -.004 -4.657 -2.011 -4.657 -4.487c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99a3.46 3.46 0 0 1 3.085 1.9" /><path d="M16 19h6" /><path d="M19 16v6" /></svg>
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
  function arrowRightIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"  className="icon icon-tabler icons-tabler-outline icon-tabler-chevron-right"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 6l6 6l-6 6" /></svg>    );
  }
  function euroIcon(){
    return (
      <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66c-2.052 0 -3.768 1.449 -4.549 3.5h-.451a1 1 0 0 0 -.117 1.993l.134 .007a7.298 7.298 0 0 0 0 1h-.017a1 1 0 0 0 0 2h.452c.78 2.053 2.496 3.5 4.548 3.5c1.141 0 2.217 -.457 3.084 -1.27a1 1 0 0 0 -1.368 -1.46c-.509 .478 -1.102 .73 -1.716 .73c-.922 0 -1.776 -.578 -2.335 -1.499l1.335 -.001a1 1 0 0 0 0 -2h-1.977a5.342 5.342 0 0 1 0 -1h1.977a1 1 0 0 0 0 -2h-1.336c.56 -.921 1.414 -1.5 2.336 -1.5c.615 0 1.208 .252 1.717 .73a1 1 0 0 0 1.368 -1.46c-.867 -.812 -1.943 -1.27 -3.085 -1.27z" /></svg>
    )
  }

  return (
    <div className="calendar_container">
      <nav className="options_btn">
        <ul>
          <li className="mySubs_btn" onClick={ () =>{window.location.href = '/mysubs';}}>{mySubsIcon()} My Subscriptions {arrowRightIcon()}</li>
          {/* <li className="dashboard_btn" title="My Dashboard">{dashboardIcon()}</li> */}
          <li className="new_btn" onClick={ () =>{window.location.href = '/newsub';}} title="New sub">{newIcon()} New Subscription {arrowRightIcon()}</li>
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
        </div>
        <div className="header_text" onClick={handleToday}>
          <p className="nombre_mes">{meses[month]}</p>
          <p className="año">{year}</p>
        </div>
          <div className="spent_container">
            <p className="spent_title">Monthly spend</p>
            <div className="spent_value">{isLoading ? <LoadingSpinner/> : (<>{getSpentValue()} {euroIcon()}</>)}</div>
          </div>
      </header>

      {/* Sección del calendario */}
      <section 
        className="calendar_body"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Días de la semana */}
        {diasSemana.map((dia) => (
          <div key={dia} className="diaSemana">
            {dia}
          </div>
        ))}

        {/* Días del mes */}
        {isLoading ? <LoadingSpinner/> : daysArray.map((dayNumber, index) => {
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
