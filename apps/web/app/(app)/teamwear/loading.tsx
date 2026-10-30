import { Skeleton, SkeletonPage, SkeletonPanel } from "@/components/ui/Skeleton";

/** The stage and the right panel in outline, so the configurator answers a click straight away. */
export default function TeamwearLoading() {
  return (
    <SkeletonPage label="Loading the teamwear configurator" className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,2fr)_22rem] lg:gap-4">
      <div className="flex flex-col gap-3">
        <Skeleton className="h-11 w-72 rounded-full" />
        <Skeleton className="h-[24rem] w-full rounded-2xl" />
      </div>
      <SkeletonPanel className="h-[24rem]" />
    </SkeletonPage>
  );
}
