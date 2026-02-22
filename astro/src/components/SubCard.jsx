import React, { useState, useEffect } from "react";
import '../styles/SubCard.css';
import LoadingSpinner from "./LoadingSpinner";
import { toast } from "@pheralb/toast";
import EditForm from "./EditForm";

export default function SubCard() {

  const [subs, setSubs] = useState([]);
  const [isLoading, setLoading] = useState([]);
  const [noSubs, setNoSubs] = useState([]);

  const [isLoadingCancel, setLoadingCancel] = useState(false);
  const [isModalOpen, setModalOpen] = useState(false);
  const [subToDelete, setSubToDelete] = useState(null);
  const [subToCancel, setSubToCancel] = useState(null);
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [subToEdit, setSubToEdit] = useState(null);

  const fetchSubs = async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/crud/get-all-subs");
      if (!response.ok) {
        throw new Error(`Error fetching subs: ${response.statusText}`);
      }
      const data = await response.json();
      if (data.success && data.subscriptions) {
        setNoSubs(data.subscriptions.length === 0 ? <>You don´t have subscriptions. <div onClick={() => { window.location.href = '/newsub'; }} className="redirectNewSub_btn">Create sub</div> </> : null);
        setSubs(data.subscriptions);
      } else {
        console.error("No subscriptions in data:", data);
      }
    } catch (error) {
      console.error("Error fetching subs:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubs();
  }, []);

  function setToNoon(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
  }

  function isActive(sub) {

    const current = setToNoon(new Date());
    // Parsear la fecha de inicio
    const start = setToNoon(new Date(sub.start_date));
    if (start > current) {
      return false;
    }

    if (sub.end_date) {
      const end = setToNoon(new Date(sub.end_date));
      if (end < current) {
        return false;
      }
    }
    return true
  }

  function getFrequencyText(frequency) {
    if (frequency === 'monthly') {
      return 'month/s';
    } else if (frequency === 'weekly') {
      return 'week/s';
    } else if (frequency === 'yearly') {
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

        // Calcular el día efectivo de pago para el mes actual
        const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
        const effectiveDay = Math.min(start.getDate(), daysInCurrentMonth);

        if (current.getDate() < effectiveDay) {
          diffMonths--;
        }
        periods = Math.round(diffMonths / (sub.frequency_value || 1)) + 1;
        break;
      }
      case "yearly": {
        let diffYears = current.getFullYear() - start.getFullYear();

        // Calcular si ya se ha alcanzado la fecha en el año actual
        const daysInCurrentMonth = new Date(current.getFullYear(), start.getMonth() + 1, 0).getDate();
        const effectiveDay = Math.min(start.getDate(), daysInCurrentMonth);

        if (
          current.getMonth() < start.getMonth() ||
          (current.getMonth() === start.getMonth() && current.getDate() < effectiveDay)
        ) {
          diffYears--;
        }
        periods = Math.round(diffYears / (sub.frequency_value || 1)) + 1;
        break;
      }
      default:
        periods = 1;
    }

    return parseFloat((sub.cost * periods).toFixed(2));
  }

  function handleDeleteOpenModal(identificator) {
    setModalOpen(true);
    setSubToDelete(identificator);
  }
  function handleDeleteCancel() {
    setModalOpen(false);
    setSubToDelete(null);
  }

  function handleDelete() {
    setLoading(true);
    fetch('/api/crud/delete-sub', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: subToDelete
      })
    })
      .then(response => response.json())
      .then(data => {
        console.log('Respuesta:', data);
        toast.success({
          text: 'Subscription deleted successfully! 🎉',
          delayDuration: 4000
        });
        setModalOpen(false);
        setSubToDelete(null);
        setLoading(false);
        fetchSubs();
      })
      .catch(error => {
        setModalOpen(false);
        setSubToDelete(null);
        setLoading(false);
        console.error('Error:', error);
      });
  }
  function handleCancelSub(identificator) {
    setSubToCancel(identificator);
    setLoadingCancel(true);
    fetch('/api/crud/cancel-sub', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        id: identificator
      })
    })
      .then(response => response.json())
      .then(data => {
        console.log('Respuesta:', data);
        toast.success({
          text: 'Subscription canceled successfully! 🎉',
          delayDuration: 4000
        });
        setLoadingCancel(false);
        fetchSubs();
      })
      .catch(error => {
        console.error('Error:', error);
        setLoadingCancel(false);
      });
  }

  function handleEditSub(sub) {
    setEditModalOpen(true);
    setSubToEdit(sub);
  }
  function handleChildEvent(value) {
    if (value) {
      toast.success({
        text: 'Changes saved successfully! 🎉',
        delayDuration: 4000
      });
    }
    fetchSubs();
    setEditModalOpen(false);
  }

  function activeIcon() {
    return (
      <svg className="activeIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12.01 2.011a3.2 3.2 0 0 1 2.113 .797l.154 .145l.698 .698a1.2 1.2 0 0 0 .71 .341l.135 .008h1a3.2 3.2 0 0 1 3.195 3.018l.005 .182v1c0 .27 .092 .533 .258 .743l.09 .1l.697 .698a3.2 3.2 0 0 1 .147 4.382l-.145 .154l-.698 .698a1.2 1.2 0 0 0 -.341 .71l-.008 .135v1a3.2 3.2 0 0 1 -3.018 3.195l-.182 .005h-1a1.2 1.2 0 0 0 -.743 .258l-.1 .09l-.698 .697a3.2 3.2 0 0 1 -4.382 .147l-.154 -.145l-.698 -.698a1.2 1.2 0 0 0 -.71 -.341l-.135 -.008h-1a3.2 3.2 0 0 1 -3.195 -3.018l-.005 -.182v-1a1.2 1.2 0 0 0 -.258 -.743l-.09 -.1l-.697 -.698a3.2 3.2 0 0 1 -.147 -4.382l.145 -.154l.698 -.698a1.2 1.2 0 0 0 .341 -.71l.008 -.135v-1l.005 -.182a3.2 3.2 0 0 1 3.013 -3.013l.182 -.005h1a1.2 1.2 0 0 0 .743 -.258l.1 -.09l.698 -.697a3.2 3.2 0 0 1 2.269 -.944zm3.697 7.282a1 1 0 0 0 -1.414 0l-3.293 3.292l-1.293 -1.292l-.094 -.083a1 1 0 0 0 -1.32 1.497l2 2l.094 .083a1 1 0 0 0 1.32 -.083l4 -4l.083 -.094a1 1 0 0 0 -.083 -1.32z" /></svg>
    )
  }
  function inactiveIcon() {
    return (
      <svg className="inactiveIcon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M12.01 2.011a3.2 3.2 0 0 1 2.113 .797l.154 .145l.698 .698a1.2 1.2 0 0 0 .71 .341l.135 .008h1a3.2 3.2 0 0 1 3.195 3.018l.005 .182v1c0 .27 .092 .533 .258 .743l.09 .1l.697 .698a3.2 3.2 0 0 1 .147 4.382l-.145 .154l-.698 .698a1.2 1.2 0 0 0 -.341 .71l-.008 .135v1a3.2 3.2 0 0 1 -3.018 3.195l-.182 .005h-1a1.2 1.2 0 0 0 -.743 .258l-.1 .09l-.698 .697a3.2 3.2 0 0 1 -4.382 .147l-.154 -.145l-.698 -.698a1.2 1.2 0 0 0 -.71 -.341l-.135 -.008h-1a3.2 3.2 0 0 1 -3.195 -3.018l-.005 -.182v-1a1.2 1.2 0 0 0 -.258 -.743l-.09 -.1l-.697 -.698a3.2 3.2 0 0 1 -.147 -4.382l.145 -.154l.698 -.698a1.2 1.2 0 0 0 .341 -.71l.008 -.135v-1l.005 -.182a3.2 3.2 0 0 1 3.013 -3.013l.182 -.005h1a1.2 1.2 0 0 0 .743 -.258l.1 -.09l.698 -.697a3.2 3.2 0 0 1 2.269 -.944z" /></svg>
    )
  }
  function arrowIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M5 12l14 0" /><path d="M13 18l6 -6" /><path d="M13 6l6 6" /></svg>
    )
  }
  function backIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" ><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M9 14l-4 -4l4 -4" /><path d="M5 10h11a4 4 0 1 1 0 8h-1" /></svg>
    )
  }
  function euroIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M17 3.34a10 10 0 1 1 -15 8.66l.005 -.324a10 10 0 0 1 14.995 -8.336zm-5 2.66c-2.052 0 -3.768 1.449 -4.549 3.5h-.451a1 1 0 0 0 -.117 1.993l.134 .007a7.298 7.298 0 0 0 0 1h-.017a1 1 0 0 0 0 2h.452c.78 2.053 2.496 3.5 4.548 3.5c1.141 0 2.217 -.457 3.084 -1.27a1 1 0 0 0 -1.368 -1.46c-.509 .478 -1.102 .73 -1.716 .73c-.922 0 -1.776 -.578 -2.335 -1.499l1.335 -.001a1 1 0 0 0 0 -2h-1.977a5.342 5.342 0 0 1 0 -1h1.977a1 1 0 0 0 0 -2h-1.336c.56 -.921 1.414 -1.5 2.336 -1.5c.615 0 1.208 .252 1.717 .73a1 1 0 0 0 1.368 -1.46c-.867 -.812 -1.943 -1.27 -3.085 -1.27z" /></svg>
    )
  }
  function editIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1" /><path d="M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z" /><path d="M16 5l3 3" /></svg>
    )
  }
  function deleteIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M20 6a1 1 0 0 1 .117 1.993l-.117 .007h-.081l-.919 11a3 3 0 0 1 -2.824 2.995l-.176 .005h-8c-1.598 0 -2.904 -1.249 -2.992 -2.75l-.005 -.167l-.923 -11.083h-.08a1 1 0 0 1 -.117 -1.993l.117 -.007h16zm-9.489 5.14a1 1 0 0 0 -1.218 1.567l1.292 1.293l-1.292 1.293l-.083 .094a1 1 0 0 0 1.497 1.32l1.293 -1.292l1.293 1.292l.094 .083a1 1 0 0 0 1.32 -1.497l-1.292 -1.293l1.292 -1.293l.083 -.094a1 1 0 0 0 -1.497 -1.32l-1.293 1.292l-1.293 -1.292l-.094 -.083z" /><path d="M14 2a2 2 0 0 1 2 2a1 1 0 0 1 -1.993 .117l-.007 -.117h-4l-.007 .117a1 1 0 0 1 -1.993 -.117a2 2 0 0 1 1.85 -1.995l.15 -.005h4z" /></svg>
    )
  }
  function cancelIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M13 21h-7a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12a2 2 0 0 1 2 2v6.5" /><path d="M16 3v4" /><path d="M8 3v4" /><path d="M4 11h16" /><path d="M22 22l-5 -5" /><path d="M17 22l5 -5" /></svg>
    )
  }
  function backCalendarIcon() {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path stroke="none" d="M0 0h24v24H0z" fill="none" /><path d="M16 2c.183 0 .355 .05 .502 .135l.033 .02c.28 .177 .465 .49 .465 .845v1h1a3 3 0 0 1 2.995 2.824l.005 .176v12a3 3 0 0 1 -2.824 2.995l-.176 .005h-12a3 3 0 0 1 -2.995 -2.824l-.005 -.176v-12a3 3 0 0 1 2.824 -2.995l.176 -.005h1v-1a1 1 0 0 1 .514 -.874l.093 -.046l.066 -.025l.1 -.029l.107 -.019l.12 -.007q .083 0 .161 .013l.122 .029l.04 .012l.06 .023c.328 .135 .568 .44 .61 .806l.007 .117v1h6v-1a1 1 0 0 1 1 -1m3 7h-14v9.625c0 .705 .386 1.286 .883 1.366l.117 .009h12c.513 0 .936 -.53 .993 -1.215l.007 -.16z" /><path d="M9.015 13a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1" /><path d="M13.015 13a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1" /><path d="M17.02 13a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1" /><path d="M12.02 15a1 1 0 0 1 0 2a1.001 1.001 0 1 1 -.005 -2z" /><path d="M9.015 16a1 1 0 0 1 -1 1a1.001 1.001 0 1 1 -.005 -2c.557 0 1.005 .448 1.005 1" /></svg>
    )
  }

  function formatDate(dateString) {
    if (!dateString) return null;
    const [year, month, day] = dateString.split('-');
    return `${day}-${month}-${year}`;
  }

  return (
    <div className='body'>
      <div className="subscriptions">
        {isLoading && !isModalOpen && subs.length === 0 ? <LoadingSpinner /> : null}
        {subs.length === 0 ? noSubs : subs.map((sub, index) => (
          <div key={index} className="subCard">
            <div className='sub_container'>
              <img src={sub.icon} alt="subscription icon" className="sub_icon" />
              <div className='card_body'>
                <div className='card_header'>
                  <h2 className="sub_name texto-largo">{sub.service_name}</h2>
                  <div className="card_header-columnRight"></div>
                  <div className="sub_cost">{sub.cost} {euroIcon()}</div>
                </div>
                <div className="sub_startDate">Total since {formatDate(sub.start_date)} {arrowIcon()}  <span className="totalCost">{getTotalCost(sub)} {euroIcon()}</span></div>
                <div className="sub_endDate">{sub.end_date ? 'End date: ' + formatDate(sub.end_date) : null}</div>
                <div className="sub_frequency">Every {sub.frequency_value} {getFrequencyText(sub.frequency)}</div>
                <div className="card_active">
                  <div className="card_active_icon">
                    {isActive(sub) ? activeIcon() : inactiveIcon()}
                  </div>
                  {isActive(sub) ? 'Active' : 'Inactive'}
                </div>
              </div>
            </div>
            <div className='card_footer'>
              <div className='edit_btn btn' onClick={() => handleEditSub(sub)}>{editIcon()}Edit</div>
              {!sub.end_date && isActive(sub) && (
                <div className='cancel_btn btn' onClick={() => handleCancelSub(sub.id)}>{isLoadingCancel && subToCancel === sub.id ? <>{cancelIcon()} <LoadingSpinner /></> : <>{cancelIcon()}Cancel Sub</>}</div>
              )}
              <div className='delete_btn btn' onClick={() => handleDeleteOpenModal(sub.id)}>{deleteIcon()}</div>
            </div>
          </div>
        ))}
      </div>
      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h2>Confirm Deletion</h2>
            <p>Are you sure you want to delete this subscription?</p>
            <div className="modal-actions">
              <button className="modal-delete_btn" onClick={handleDelete}>{isLoading && isModalOpen ? <LoadingSpinner /> : 'Yes, Delete'}</button>
              <button className="modal-cancel_btn" onClick={handleDeleteCancel}>Cancel</button>
            </div>
          </div>
        </div>
      )}
      {isEditModalOpen && (
        <EditForm onChildEvent={handleChildEvent} subscription={subToEdit} />
      )}
    </div>
  );

}
