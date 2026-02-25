"use client";

import CalendarBody from "@/components/CalendarBody";
import HomeBalanceCard from "@/components/home/HomeBalanceCard";
import HomeMonthlySummaryCard from "@/components/home/HomeMonthlySummaryCard";
import HomeBudgetsCard from "@/components/home/HomeBudgetsCard";

export default function HomePage() {
  return (
    <div className="home-container">
      <section className="home-main" aria-label="Inicio">
        <div className="home-main-calendar">
          <CalendarBody />
        </div>
        <div className="home-main-card home-main-card-1">
          <HomeBalanceCard />
        </div>
        <div className="home-main-card home-main-card-2">
          <HomeMonthlySummaryCard />
        </div>
        <div className="home-main-card home-main-card-3">
          <HomeBudgetsCard />
        </div>
      </section>
    </div>
  );
}
