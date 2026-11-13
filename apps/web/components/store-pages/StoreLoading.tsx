import { Skeleton } from "@/components/ui/Skeleton";

/** A Store tab while it loads (10 §9 "Loading"): the title, the tab row and the shape of the cards. */
export function StoreLoading() {
  return (
    <div role="status" aria-label="Loading the store" className="flex flex-col gap-8 pt-6">
      <Skeleton className="h-9 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-36 w-full rounded-xl" />
        ))}
      </div>
    </div>
  );
}
