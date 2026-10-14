import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonFormPanel } from "@/components/ui/SkeletonForms";

/** The new design form while it loads. */
export default function NewDesignLoading() {
  return (
    <SkeletonPage className="flex max-w-xl flex-col gap-6">
      <SkeletonHeading />
      <SkeletonFormPanel lines={0} />
    </SkeletonPage>
  );
}
