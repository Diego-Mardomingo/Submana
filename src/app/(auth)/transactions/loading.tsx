import { Skeleton } from "@/components/ui/skeleton";

export default function TransactionsLoading() {
  return (
    <div className="page-container tx-page fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="page-header-text">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-44 mt-1" />
          </div>
        </div>
        <div className="page-header-right">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </header>

      <div className="tx-month-nav">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>

      <div className="tx-summary-bar">
        <Skeleton className="h-14 flex-1 rounded-lg" />
        <Skeleton className="h-14 flex-1 rounded-lg" />
        <Skeleton className="h-14 flex-1 rounded-lg" />
      </div>

      <section className="tx-list">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="tx-item-skeleton">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-5 w-16" />
          </div>
        ))}
      </section>
    </div>
  );
}
