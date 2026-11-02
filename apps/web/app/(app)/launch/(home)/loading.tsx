import { Skeleton, SkeletonPage, SkeletonPanel, SkeletonText } from "@/components/ui/Skeleton";

/** Shown at once while the launch projects are read, so a click answers straight away. */
export default function LaunchLoading() {
  return (
    <SkeletonPage label="Loading your launch projects" className="flex flex-col gap-8">
      <div className="flex max-w-2xl flex-col gap-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-8 w-72" />
        <SkeletonText lines={2} />
      </div>
      <SkeletonPanel />
      <SkeletonPanel>
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </SkeletonPanel>
    </SkeletonPage>
  );
}
