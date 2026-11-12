import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

/**
 * The loading state of the Products pages (10 §9 "Loading"): `soft` blocks in the shape of the page that is coming,
 * the title and tabs, then a grid of square cards or a list of rows.
 */
export function ProductsSkeleton({ label, shape = "grid" }: Readonly<{ label: string; shape?: "grid" | "rows" }>) {
  return (
    <SkeletonPage label={label} className="flex flex-col gap-6 pt-6">
      <Skeleton className="h-9 w-56" />
      <Skeleton className="h-10 w-full max-w-120" />
      {shape === "grid" ? (
        <div className="grid grid-cols-2 gap-5 md:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="flex flex-col gap-2">
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-16 w-full" />
          ))}
        </div>
      )}
    </SkeletonPage>
  );
}
