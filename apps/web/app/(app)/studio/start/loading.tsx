import { Skeleton, SkeletonPage, SkeletonPanel } from "@/components/ui/Skeleton";
import { SkeletonFormPage } from "@/components/ui/SkeletonForms";

/** The guided start while it loads: the heading and the ways in. */
export default function StartLoading() {
  return (
    <SkeletonPage>
      <SkeletonFormPage>
        <SkeletonPanel>
          <Skeleton className="h-5 w-48" />
          <div className="grid gap-3 sm:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} className="h-16 w-full rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-28 w-full rounded-2xl" />
          <Skeleton className="h-10 w-36" />
        </SkeletonPanel>
      </SkeletonFormPage>
    </SkeletonPage>
  );
}
