import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonFormPanel } from "@/components/ui/SkeletonForms";

/** Brands while it loads: the heading, then rename, organisation and add a brand. */
export default function BrandsLoading() {
  return (
    <SkeletonPage label="Loading your brands" className="flex max-w-2xl flex-col gap-8">
      <SkeletonHeading />
      <SkeletonFormPanel lines={0} />
      <SkeletonFormPanel lines={1} />
      <SkeletonFormPanel lines={1} />
    </SkeletonPage>
  );
}
