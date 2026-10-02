"use client";

import CalendarBody from "@/components/CalendarBody";
import { CalendarFilterProvider } from "@/contexts/CalendarFilterContext";

export default function HomePage() {
  return (
    <CalendarFilterProvider>
      <CalendarBody />
    </CalendarFilterProvider>
  );
}
