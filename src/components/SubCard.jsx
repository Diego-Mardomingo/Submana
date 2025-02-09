import React, { useState, useEffect } from "react";
import '../styles/SubCard.css';
import LoadingSpinner from "./LoadingSpinner";

export default function SubCard() {

  const [subs, setSubs] = useState([]);
  const [isLoading, setLoading] = useState([]);

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
          setSubs(data.subscriptions);
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
  
    function isActive(sub) {
  
      const current = setToNoon(new Date());
      // Parsear la fecha de inicio
      const start = setToNoon(new Date(sub.start_date));
      if(start > current){
        return false;
      }
  
      if(sub.end_date){
        const end = setToNoon(new Date(sub.end_date));
        if(end < current){
          return false;
        }
      }
      return true
    }

    function getFrequencyText(frequency){
      if(frequency === 'monthly'){
        return 'month/s';
      }else if(frequency === 'weekly'){
        return 'week/s';
      }else if(frequency === 'yearly'){
        return 'year/s';
      }
    }

    function getTotalCost(sub) {
      const start = setToNoon(new Date(sub.start_date));
      const current = setToNoon(new Date());
      
      if (current < start) return 0;
      
      let periods = 0;
      
      switch (sub.frequency) {
        case "weekly": {
          const msInDay = 1000 * 60 * 60 * 24;
          const diffDays = Math.round((current - start) / msInDay);
          const interval = 7 * (sub.frequency_value || 1);
          periods = Math.round(diffDays / interval) + 1;
          break;
        }
        case "monthly": {
          const startYear = start.getFullYear();
          const startMonth = start.getMonth();
          const currentYear = current.getFullYear();
          const currentMonth = current.getMonth();
          let diffMonths = (currentYear - startYear) * 12 + (currentMonth - startMonth);
          if (current.getDate() < start.getDate()) {
            diffMonths--;
          }
          periods = Math.round(diffMonths / (sub.frequency_value || 1)) + 1;
          break;
        }
        case "yearly": {
          let diffYears = current.getFullYear() - start.getFullYear();
          if (
            current.getMonth() < start.getMonth() ||
            (current.getMonth() === start.getMonth() && current.getDate() < start.getDate())
          ) {
            diffYears--;
          }
          periods = Math.round(diffYears / (sub.frequency_value || 1)) + 1;
          console.log(diffYears);
          break;
        }
        default:
          periods = 1;
      }
      
      return parseFloat((sub.cost * periods).toFixed(2));
    }

    function activeIcon(){
      return (
        <svg className="activeIcon"  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor" ><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12.01 2.011a3.2 3.2 0 0 1 2.113 .797l.154 .145l.698 .698a1.2 1.2 0 0 0 .71 .341l.135 .008h1a3.2 3.2 0 0 1 3.195 3.018l.005 .182v1c0 .27 .092 .533 .258 .743l.09 .1l.697 .698a3.2 3.2 0 0 1 .147 4.382l-.145 .154l-.698 .698a1.2 1.2 0 0 0 -.341 .71l-.008 .135v1a3.2 3.2 0 0 1 -3.018 3.195l-.182 .005h-1a1.2 1.2 0 0 0 -.743 .258l-.1 .09l-.698 .697a3.2 3.2 0 0 1 -4.382 .147l-.154 -.145l-.698 -.698a1.2 1.2 0 0 0 -.71 -.341l-.135 -.008h-1a3.2 3.2 0 0 1 -3.195 -3.018l-.005 -.182v-1a1.2 1.2 0 0 0 -.258 -.743l-.09 -.1l-.697 -.698a3.2 3.2 0 0 1 -.147 -4.382l.145 -.154l.698 -.698a1.2 1.2 0 0 0 .341 -.71l.008 -.135v-1l.005 -.182a3.2 3.2 0 0 1 3.013 -3.013l.182 -.005h1a1.2 1.2 0 0 0 .743 -.258l.1 -.09l.698 -.697a3.2 3.2 0 0 1 2.269 -.944zm3.697 7.282a1 1 0 0 0 -1.414 0l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.32 1.497l2 2l.094 .083a1 1 0 0 0 1.32 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" /></svg>
      )
    }
    function inactiveIcon(){
      return (
        <svg className="inactiveIcon"  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M12.01 2.011a3.2 3.2 0 0 1 2.113 .797l.154 .145l.698 .698a1.2 1.2 0 0 0 .71 .341l.135 .008h1a3.2 3.2 0 0 1 3.195 3.018l.005 .182v1c0 .27 .092 .533 .258 .743l.09 .1l.697 .698a3.2 3.2 0 0 1 .147 4.382l-.145 .154l-.698 .698a1.2 1.2 0 0 0 -.341 .71l-.008 .135v1a3.2 3.2 0 0 1 -3.018 3.195l-.182 .005h-1a1.2 1.2 0 0 0 -.743 .258l-.1 .09l-.698 .697a3.2 3.2 0 0 1 -4.382 .147l-.154 -.145l-.698 -.698a1.2 1.2 0 0 0 -.71 -.341l-.135 -.008h-1a3.2 3.2 0 0 1 -3.195 -3.018l-.005 -.182v-1a1.2 1.2 0 0 0 -.258 -.743l-.09 -.1l-.697 -.698a3.2 3.2 0 0 1 -.147 -4.382l.145 -.154l.698 -.698a1.2 1.2 0 0 0 .341 -.71l.008 -.135v-1l.005 -.182a3.2 3.2 0 0 1 3.013 -3.013l.182 -.005h1a1.2 1.2 0 0 0 .743 -.258l.1 -.09l.698 -.697a3.2 3.2 0 0 1 2.269 -.944z" /></svg>
      )
    }
    function arrowIcon(){
      return (
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
      )
    }
    function backIcon(){
      return (
        <svg  xmlns="http://www.w3.org/2000/svg"  width="24"  height="24"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  strokeWidth="2"  strokeLinecap="round"  strokeLinejoin="round" ><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
      )
    }

  return (
    <div className='body'>
      <div className='back_btn' onClick={ () =>{window.location.href = '/';}}>{backIcon()} Back</div>
      <div className="subscriptions">
        <h1 className="title">My Subscriptions</h1>
        {isLoading ? <LoadingSpinner/> : null}
        {subs.map((sub, index) => (
          <div key={index} className="subCard">
            <img src={sub.icon} alt="subscription icon" className="sub_icon" />
            <div className='card_body'>
              <div className='card_header'>
                <h2 className="sub_name">{sub.service_name}</h2>
                <div className="card_header-columnRight"></div>
                <div className="sub_cost">{sub.cost}€</div>
              </div>
              <div className="sub_startDate">Total since {sub.start_date} {arrowIcon()}  <span className="totalCost">{getTotalCost(sub)}€</span></div>
              <div className="sub_endDate">{sub.end_date ? 'End date: '+sub.end_date: null}</div>
              <div className="sub_frequency">Every {sub.frequency_value} {getFrequencyText(sub.frequency)}</div>
              <div className="card_active">
                  <div className="card_active_icon">
                    {isActive(sub) ? activeIcon() : inactiveIcon()}
                  </div>
                  {isActive(sub) ? 'Active' : 'Inactive'}
                </div>
              {/* <div className='card_footer'>
                <div className='edit_btn btn'>Edit</div>
                <div className='cancel_btn btn'>Cancel</div>
                <div className='delete_btn btn'>Delete</div>
              </div> */}
            </div>
          </div>
        ))}
      </div>

    </div>
  );

}