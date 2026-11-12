import { Skeleton, SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";

/** Team while it loads (10 §9): the title and buttons, the tabs, then the roster's rows. */
export default function TeamLoading() {
  return (
    <SkeletonPage label="Loading your team" className="flex flex-col gap-6 pt-4">
      <SkeletonHeading className="max-w-md" />
      <Skeleton className="h-11 w-80" />
      {Array.from({ length: 6 }, (_, row) => (
        <Skeleton key={row} className="h-12 w-full" />
      ))}
    </SkeletonPage>
  );
}
