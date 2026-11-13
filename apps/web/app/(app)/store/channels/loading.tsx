import { Skeleton, SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";

/** Sales channels while they load (10 §9): the title, the chips, then the grid of cards. */
export default function SalesChannelsLoading() {
  return (
    <SkeletonPage label="Loading your sales channels" className="flex flex-col gap-6 pt-4">
      <SkeletonHeading className="max-w-md" />
      <Skeleton className="h-11 w-full max-w-3xl" />
      <div className="grid gap-5 lg:grid-cols-2">
        {Array.from({ length: 6 }, (_, card) => (
          <Skeleton key={card} className="h-52 w-full" />
        ))}
      </div>
    </SkeletonPage>
  );
}
