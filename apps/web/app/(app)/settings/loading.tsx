import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonFormPanel } from "@/components/ui/SkeletonForms";

/** Settings while it loads: the heading, then the name, emails and delete sections. */
export default function SettingsLoading() {
  return (
    <SkeletonPage label="Loading your settings" className="flex max-w-2xl flex-col gap-8">
      <SkeletonHeading />
      <SkeletonFormPanel lines={0} />
      <SkeletonFormPanel lines={2} field={false} />
      <SkeletonFormPanel lines={3} />
    </SkeletonPage>
  );
}
