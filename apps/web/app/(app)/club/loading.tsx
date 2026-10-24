import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** The club while it loads: the heading, then the kit, members and seasons. */
export default function ClubLoading() {
  return (
    <SkeletonPage label="Loading your club" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={2} />
      <SkeletonSection lines={2} />
    </SkeletonPage>
  );
}
