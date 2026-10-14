import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** Brands while it loads: the heading, then rename, organisation and add a brand. */
export default function BrandsLoading() {
  return (
    <SkeletonPage label="Loading your brands" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={0} />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={1} />
    </SkeletonPage>
  );
}
