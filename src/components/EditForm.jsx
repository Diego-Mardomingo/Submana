import React, { useState, useEffect } from "react";
import Icon from "./Icon";
import LoadingSpinner from "./LoadingSpinner";
import "../styles/EditForm.css";

export default function EditForm({ onChildEvent, subscription }) {

  const [isLoading, setLoading] = useState(false);

  function handleChildEvent() {
    onChildEvent(false);
  }

  function handleUpdateSub() {
    setLoading(true);
    const form = document.getElementById("updateSubForm");
    if (!form) return;
    const formData = new FormData(form);
    
    const updatedSub = {
      id: subscription.id,
      service_name: formData.get("name"),
      icon: formData.get("icon"),
      cost: parseFloat(formData.get("cost")),
      start_date: formData.get("startDate"),
      end_date: formData.get("endDate") || null,
      frequency: formData.get("frequency"),
      frequency_value: parseInt(formData.get("frequency_value"), 10)
    };
  
    fetch("/api/crud/updateSub", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(updatedSub)
    })
      .then(response => response.json())
      .then(() => {
        setLoading(false);
        onChildEvent(true);
      })
      .catch(error => {
        console.error("Error updating subscription:", error);
        setLoading(false);
      });
  }

  function handleSelectedIcon(icon){
    console.log("Icon selected:", icon);
  }
  

  return (
    <div className="modal-overlayEdit">
      <div className="modalEdit">
        <h1>Edit Subscription</h1>
        <form id="updateSubForm" action="" method="post">
          <label htmlFor="nombre">Name</label>
          <input
            defaultValue={subscription.service_name}
            type="text"
            id="name"
            name="name"
            placeholder="Subscription name"
            autoComplete="off"
            required
          />

          <input defaultValue={subscription.icon} type="hidden" id="icon_value" name="icon" />
          <Icon client:visible onIconSelected={handleSelectedIcon} defaultIcon={subscription.icon} />

          <label htmlFor="cost">Cost</label>
          <input
            defaultValue={subscription.cost}
            type="number"
            id="cost"
            name="cost"
            placeholder="0.00"
            step="0.01"
            min="0"
            required
          />

          <label htmlFor="startDate">Start Date</label>
          <input
            defaultValue={subscription.start_date}
            type="date"
            id="startDate"
            name="startDate"
            required
          />

          <label htmlFor="endDate">End Date (optional)</label>
          <input
            defaultValue={subscription.end_date}
            type="date"
            id="endDate"
            name="endDate"
          />

          <label htmlFor="frequency">Frequency</label>
          <select
            defaultValue={subscription.frequency}
            id="frequency"
            name="frequency"
          >
            <option value="weekly">Weekly</option>
            <option value="monthly" selected>
              Monthly
            </option>
            <option value="yearly">Yearly</option>
          </select>

          <label htmlFor="frequency_value">Frequency Value</label>
          <input
            defaultValue={subscription.frequency_value}
            type="number"
            id="frequency_value"
            name="frequency_value"
            placeholder="2 -> (every 2 months)"
            min="1"
          />

          <div className="btn-group">
            <button
              type="button"
              className="btn-cancel"
              onClick={handleChildEvent}
            >
              Cancel
            </button>
            <button
              id="create_btn"
              type="button"
              className="btn-create"
              onClick={handleUpdateSub}
            >
              Update {isLoading ? <LoadingSpinner/> : ''}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
