import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonPanel } from "@/components/ui/Skeleton";

/** Size charts while they load: the heading, the table and the import. */
export default function ChartsLoading() {
  return (
    <SkeletonPage label="Loading your size charts" className="flex flex-col gap-8">
      <SkeletonHeading />
      <SkeletonPanel className="gap-3">
        {Array.from({ length: 5 }, (_, row) => (
          <Skeleton key={row} className={row === 0 ? "h-4 w-full opacity-60" : "h-4 w-full"} />
        ))}
      </SkeletonPanel>
      <SkeletonPanel />
    </SkeletonPage>
  );
}
