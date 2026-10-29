import { SkeletonHeading, SkeletonPage, SkeletonPanel } from "@/components/ui/Skeleton";

/** Shown at once while the catalogue is read, so a press on Base products answers straight away. */
export default function CatalogueLoading() {
  return (
    <SkeletonPage label="Loading the catalogue" className="flex flex-col gap-6">
      <SkeletonHeading />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((at) => (
          <SkeletonPanel key={at} className="h-64" />
        ))}
      </div>
    </SkeletonPage>
  );
}
