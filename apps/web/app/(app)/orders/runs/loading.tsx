import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** The brand workspace while it loads: the heading, then the product list and the run builder. */
export default function BrandLoading() {
  return (
    <SkeletonPage label="Loading your brand workspace" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={3} />
    </SkeletonPage>
  );
}
