import { Skeleton, SkeletonPanel, SkeletonText } from "./Skeleton";

/** A form section while it loads: a heading, a few lines of text, a field and a button. */
export function SkeletonFormPanel({ lines = 1, field = true }: Readonly<{ lines?: number; field?: boolean }>) {
  return (
    <SkeletonPanel>
      <Skeleton className="h-5 w-44" />
      {lines > 0 ? <SkeletonText lines={lines} /> : null}
      {field ? <Skeleton className="h-11 w-full rounded-2xl" /> : null}
      <Skeleton className="h-10 w-32" />
    </SkeletonPanel>
  );
}
