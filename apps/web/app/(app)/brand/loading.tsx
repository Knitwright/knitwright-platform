import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** Brand Studio while it loads: the heading, then the tabs and the panel of the tab asked for. */
export default function BrandStudioLoading() {
  return (
    <SkeletonPage label="Loading your brand" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={4} />
    </SkeletonPage>
  );
}
