"use client";

import CalendarBody from "@/components/CalendarBody";
import { CalendarFilterProvider } from "@/contexts/CalendarFilterContext";

export default function HomePage() {
  return (
    <CalendarFilterProvider>
      <div className="home-container">
        <section className="home-main home-main-calendar-only" aria-label="Inicio">
          <div className="home-main-calendar">
            <CalendarBody />
          </div>
        </section>
      </div>
    </CalendarFilterProvider>
  );
}
