import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

/** The library while it loads (10 §9): the grey band with its search and tabs, then two rows of square cards. */
export default function TemplatesLoading() {
  return (
    <SkeletonPage label="Loading the templates" className="flex flex-col gap-8 pt-1">
      <div className="flex flex-col items-center gap-6 rounded-3xl bg-soft px-6 py-10">
        <Skeleton className="h-9 w-96 max-w-full" />
        <Skeleton className="h-11.5 w-full max-w-155 rounded-lg" />
        <Skeleton className="h-5 w-full max-w-4xl" />
      </div>
      {[0, 1].map((row) => (
        <div key={row} className="flex flex-col gap-3">
          <Skeleton className="h-6 w-40" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 7 }, (_, card) => (
              <Skeleton key={card} className="aspect-square w-48 shrink-0 rounded-lg" />
            ))}
          </div>
        </div>
      ))}
    </SkeletonPage>
  );
}
