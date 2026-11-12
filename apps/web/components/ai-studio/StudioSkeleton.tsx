import { Skeleton, SkeletonPage } from "@/components/ui/Skeleton";

/**
 * AI Studio's loading states (10 §9: skeletons matching the final layout, never a spinner). The
 * workflow format is a white card with the form on the left and the example on the right; the agent
 * is a grey panel with its prompt card and tiles.
 */

export function WorkflowSkeleton({ label }: Readonly<{ label: string }>) {
  return (
    <SkeletonPage label={label} className="flex flex-col gap-6 pt-4">
      <div className="grid gap-10 rounded-3xl border border-border p-10 lg:grid-cols-2">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-9 w-64 rounded-md" />
          <Skeleton className="h-4 w-full rounded-md" />
          {[0, 1, 2].map((one) => (
            <div key={one} className="flex flex-col gap-3">
              <Skeleton className="h-6 w-40 rounded-md" />
              <Skeleton className="h-11 w-full rounded-md" />
            </div>
          ))}
          <Skeleton className="h-16 w-full rounded-xl" />
        </div>
        <Skeleton className="aspect-5/4 w-full rounded-3xl" />
      </div>
    </SkeletonPage>
  );
}

export function AgentSkeleton() {
  return (
    <SkeletonPage label="Loading the Creative Agent" className="flex flex-col items-center gap-6 rounded-3xl bg-soft p-10">
      <Skeleton className="h-12 w-2/3 rounded-md" />
      <Skeleton className="h-36 w-full max-w-285 rounded-prompt" />
      <div className="grid w-full grid-cols-3 gap-5">
        {[0, 1, 2].map((one) => (
          <Skeleton key={one} className="aspect-4/3 rounded-lg" />
        ))}
      </div>
    </SkeletonPage>
  );
}
