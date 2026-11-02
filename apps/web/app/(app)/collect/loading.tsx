import { SkeletonHeading, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonSection } from "@/components/ui/SkeletonForms";

/**
 * Collect while it loads: the heading, then the committee links and the sign-up. Safe here because
 * the page's guard redirects rather than answering 404 (`requireMember`), so flushing the shell
 * first cannot turn a refusal into a 200. The public pages under `/s` and `/join` deliberately have
 * no loading file for exactly that reason.
 */
export default function CollectLoading() {
  return (
    <SkeletonPage label="Loading your links" className="flex flex-col gap-8">
      <SkeletonHeading className="max-w-2xl" />
      <SkeletonSection lines={3} />
      <SkeletonSection lines={3} />
    </SkeletonPage>
  );
}
