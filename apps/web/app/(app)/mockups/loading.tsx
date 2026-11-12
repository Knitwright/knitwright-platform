import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

/** The mockups while they load (10 §9): the title and its three buttons, the categories, the colourways, then the grid. */
export default function MockupsLoading() {
  return (
    <SkeletonPage label="Loading the mockups" className="flex flex-col gap-5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Skeleton className="h-9 w-80" />
        <Skeleton className="h-10 w-120 max-w-full" />
      </div>
      <Skeleton className="h-6 w-full max-w-4xl" />
      <Skeleton className="h-8 w-64" />
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }, (_, card) => (
          <Skeleton key={card} className="aspect-[4/3] w-full rounded-xl" />
        ))}
      </div>
    </SkeletonPage>
  );
}
