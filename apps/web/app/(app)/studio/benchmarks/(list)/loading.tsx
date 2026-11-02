import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonPanel } from "@/components/ui/Skeleton";

/**
 * The brand's comparisons while they load: the heading and its note, the list, and the form that starts a new one.
 *
 * Only this screen has one. A comparison's own page answers "not found" for an id that is not the brand's, and a
 * loading screen in that folder would hold the answer open and lose the 404.
 */
export default function BenchmarksLoading() {
  return (
    <SkeletonPage label="Loading your benchmarks" className="flex flex-col gap-8">
      <SkeletonHeading />
      <SkeletonPanel className="gap-3">
        {Array.from({ length: 3 }, (_, row) => (
          <Skeleton key={row} className="h-4 w-full" />
        ))}
      </SkeletonPanel>
      <SkeletonPanel />
    </SkeletonPage>
  );
}
