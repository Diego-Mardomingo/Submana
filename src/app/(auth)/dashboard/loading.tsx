import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="page-container dashboard-page fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="page-header-text">
            <Skeleton className="h-6 w-28" />
            <Skeleton className="h-4 w-40 mt-1" />
          </div>
        </div>
      </header>
      <section className="dashboard-content">
        <div className="dashboard-grid">
          <div className="dashboard-card dashboard-card-wide">
            <Skeleton className="h-[120px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[180px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
          <div className="dashboard-card">
            <Skeleton className="h-[240px] w-full rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
