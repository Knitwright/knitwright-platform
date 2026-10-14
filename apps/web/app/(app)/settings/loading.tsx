import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** Settings while it loads: the heading, then the name, emails and delete sections. */
export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading your settings" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={0} />
      <SkeletonSection lines={2} field={false} />
      <SkeletonSection lines={3} />
    </SkeletonPage>
  );
}
