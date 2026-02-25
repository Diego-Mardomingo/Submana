"use client";

import CalendarBody from "@/components/CalendarBody";

export default function HomePage() {
  return (
    <div className="home-container">
      <section className="home-main home-main-calendar-only" aria-label="Inicio">
        <div className="home-main-calendar">
          <CalendarBody />
        </div>
      </section>
    </div>
  );
}
