import type { ReactNode } from "react";
import { Skeleton, SkeletonHeading, SkeletonText } from "./Skeleton";

/**
 * Loading shapes for the form pages, matching components/shell/PageSection.tsx and FormPage in
 * components/shell/PageIntro.tsx.
 */

/** A PageSection while it loads: the heading and text on the left, a field and a button on the right. */
export function SkeletonSection({ lines = 1, field = true }: Readonly<{ lines?: number; field?: boolean }>) {
  return (
    <div
      aria-hidden="true"
      className="grid gap-x-10 gap-y-4 rounded-2xl border border-hairline bg-surface p-6 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:p-8"
    >
      <div className="flex max-w-md flex-col gap-3">
        <Skeleton className="h-5 w-44" />
        {lines > 0 ? <SkeletonText lines={lines} /> : null}
      </div>
      <div className="flex min-w-0 max-w-xl flex-col gap-3">
        {field ? <Skeleton className="h-11 w-full rounded-2xl" /> : <Skeleton className="h-5 w-3/4" />}
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  );
}

/** A FormPage while it loads: the heading on the left, the form on the right. */
export function SkeletonFormPage({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] lg:gap-12">
      <SkeletonHeading className="max-w-2xl" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
