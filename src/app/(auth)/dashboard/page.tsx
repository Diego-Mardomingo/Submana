import HomeCategoryDonutCard from "@/components/home/HomeCategoryDonutCard";

export default function DashboardPage() {
  return (
    <div className="page-container fade-in">
      <header className="page-header">
        <h1 className="title">Dashboard</h1>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-chart-wrapper">
          <HomeCategoryDonutCard />
        </div>
      </section>
    </div>
  );
}
