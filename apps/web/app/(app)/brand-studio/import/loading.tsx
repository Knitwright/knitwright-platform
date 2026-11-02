import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** The import screen while the brand's completion % is read: the heading, then the form. */
export default function BrandImportLoading() {
  return (
    <SkeletonPage label="Loading your brand" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={3} />
    </SkeletonPage>
  );
}
