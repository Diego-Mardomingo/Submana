import { Skeleton } from "@/components/ui/skeleton";

type ChartSkeletonProps = {
  height?: string;
  showHeader?: boolean;
};

export function ChartSkeleton({ height = "h-[200px]", showHeader = true }: ChartSkeletonProps) {
  return (
    <div className="chart-skeleton w-full">
      {showHeader && (
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-4 w-16" />
        </div>
      )}
      <Skeleton className={`${height} w-full rounded-lg`} />
    </div>
  );
}
