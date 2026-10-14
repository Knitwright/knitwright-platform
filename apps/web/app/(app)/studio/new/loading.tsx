import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";
import { SkeletonFormPage } from "@/components/ui/SkeletonForms";

/** The new design form while it loads. */
export default function NewDesignLoading() {
  return (
    <SkeletonPage>
      <SkeletonFormPage>
        <div className="flex max-w-2xl flex-col gap-4 rounded-2xl border border-hairline bg-surface p-6 md:p-8">
          {Array.from({ length: 3 }, (_, field) => (
            <div key={field} className="flex flex-col gap-2">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-11 w-full rounded-2xl" />
            </div>
          ))}
          <Skeleton className="h-10 w-36" />
        </div>
      </SkeletonFormPage>
    </SkeletonPage>
  );
}
