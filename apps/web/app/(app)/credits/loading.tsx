import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/** Credits while they load: the heading, then the balance and price sections. */
export default function CreditsLoading() {
  return (
    <SkeletonPage label="Loading your credits" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={1} field={false} />
      <SkeletonSection lines={3} field={false} />
    </SkeletonPage>
  );
}
