import { Skeleton, SkeletonPage, SkeletonPanel, SkeletonText } from "@/components/ui/Skeleton";

/** The intake and the kits in outline, so crest-to-kit answers a click straight away. */
export default function CrestToKitLoading() {
  return (
    <SkeletonPage label="Loading crest to kit" className="flex flex-col gap-8">
      <div className="max-w-2xl flex-col gap-3">
        <Skeleton className="h-3 w-24 rounded-full" />
        <Skeleton className="mt-3 h-8 w-64 rounded-full" />
        <SkeletonText className="mt-3" lines={2} />
      </div>
      <div className="flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
        <SkeletonPanel className="h-[28rem]" />
        <SkeletonPanel className="h-[28rem]" />
      </div>
    </SkeletonPage>
  );
}
