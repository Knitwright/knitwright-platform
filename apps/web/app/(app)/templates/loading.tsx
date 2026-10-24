import { Skeleton, SkeletonHeading, SkeletonPage, SkeletonPanel } from "@/components/ui/Skeleton";

/** The library while it loads: the heading, the filters and a grid of cards. */
export default function TemplatesLoading() {
  return (
    <SkeletonPage label="Loading the templates" className="flex flex-col gap-6">
      <SkeletonHeading />
      <Skeleton className="h-11 w-full" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, card) => (
          <SkeletonPanel key={card} className="h-72" />
        ))}
      </div>
    </SkeletonPage>
  );
}
