import { Skeleton } from "@/components/ui/skeleton";

export default function SubscriptionsLoading() {
  return (
    <div className="page-container subs-page fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="page-header-text">
            <Skeleton className="h-6 w-36" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <div className="page-header-right">
          <Skeleton className="h-9 w-9 rounded-lg" />
        </div>
      </header>

      <div className="subs-summary">
        <Skeleton className="h-16 flex-1 rounded-xl" />
        <Skeleton className="h-16 flex-1 rounded-xl" />
      </div>

      <section className="subs-list">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="subs-item-skeleton">
            <Skeleton className="h-12 w-12 rounded-xl" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-2/3" />
              <Skeleton className="h-3 w-1/3" />
            </div>
            <div className="text-right space-y-2">
              <Skeleton className="h-5 w-16 ml-auto" />
              <Skeleton className="h-3 w-12 ml-auto" />
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
