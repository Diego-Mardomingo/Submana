import { Skeleton } from "@/components/ui/skeleton";

export default function AuthLoading() {
  return (
    <div className="page-container fade-in">
      <header className="page-header-clean">
        <div className="page-header-left">
          <Skeleton className="h-10 w-10 rounded-lg" />
          <div className="page-header-text">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
      </header>
      <section className="mt-6 space-y-4">
        <Skeleton className="h-[200px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
        <Skeleton className="h-[150px] w-full rounded-xl" />
      </section>
    </div>
  );
}
