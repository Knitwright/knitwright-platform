import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

/** The Orders area while it loads (10 §9): the title, the banner, the strip, the tabs and the table's rows. */
export default function OrdersLoading() {
  return (
    <SkeletonPage label="Loading your orders" className="flex flex-col gap-5 pt-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-32 w-full rounded-2xl" />
      <Skeleton className="h-12 w-full rounded-lg" />
      <Skeleton className="h-10 w-96 max-w-full" />
      {[0, 1, 2, 3, 4].map((row) => (
        <Skeleton key={row} className="h-11 w-full" />
      ))}
    </SkeletonPage>
  );
}
