import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

/** The marketing page while it loads (10 §9): the marks, the headline and its two buttons, the featured row and the gallery. */
export default function MarketingLoading() {
  return (
    <SkeletonPage label="Loading the marketing concepts" className="flex flex-col gap-10 pt-6">
      <div className="flex flex-col items-center gap-5">
        <Skeleton className="h-10 w-36" />
        <Skeleton className="h-9 w-120 max-w-full" />
        <Skeleton className="h-11 w-80" />
      </div>
      <div className="flex gap-3.5 overflow-hidden">
        {Array.from({ length: 6 }, (_, card) => (
          <Skeleton key={card} className="aspect-[4/5] w-50 shrink-0 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, card) => (
          <Skeleton key={card} className="aspect-[4/5] w-full rounded-lg" />
        ))}
      </div>
    </SkeletonPage>
  );
}
