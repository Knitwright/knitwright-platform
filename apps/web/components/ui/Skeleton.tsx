import type { CSSProperties, ReactNode } from "react";

/**
 * Placeholders shown while a page loads (the loading.tsx files). They copy the shape of the
 * page they stand in for, on the same glass, with a faint light sweeping across each bar. A
 * person who asks for less motion sees still bars.
 *
 * The API is small on purpose, and other screens build on it:
 * - `Skeleton`: one bar or block. Size it with `className` (h-*, w-*, rounded-*).
 * - `SkeletonText`: a few lines of text, the last one shorter.
 * - `SkeletonPanel`: a glass panel, the shape of a section or card.
 * - `SkeletonPage`: the wrapper of a whole loading screen. It tells screen readers the page is
 *   loading, fades in after a short wait so a quick page never flashes it, and carries
 *   `data-skeleton`, which the navigation timing script and tests look for.
 */

type ClassName = Readonly<{ className?: string }>;

export function Skeleton({ className = "h-4 w-full", style }: ClassName & Readonly<{ style?: CSSProperties }>) {
  return <span aria-hidden="true" style={style} className={`skeleton-bar motion-safe:shimmer block ${className}`} />;
}

const LINE_WIDTHS = ["w-full", "w-11/12", "w-4/5", "w-full", "w-3/4"] as const;

export function SkeletonText({ lines = 3, className = "" }: ClassName & Readonly<{ lines?: number }>) {
  return (
    <span aria-hidden="true" className={`flex flex-col gap-2.5 ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          className={`h-3.5 ${index === lines - 1 && lines > 1 ? "w-3/5" : LINE_WIDTHS[index % LINE_WIDTHS.length]}`}
        />
      ))}
    </span>
  );
}

export function SkeletonPanel({ className = "", children }: ClassName & Readonly<{ children?: ReactNode }>) {
  return (
    <div aria-hidden="true" className={`glass flex flex-col gap-4 rounded-[1.75rem] p-6 ${className}`}>
      {children ?? (
        <>
          <Skeleton className="h-5 w-40" />
          <SkeletonText />
        </>
      )}
    </div>
  );
}

/** A page heading: the small label, the title and a line of lead text. */
export function SkeletonHeading({ className = "" }: ClassName) {
  return (
    <div aria-hidden="true" className={`flex flex-col gap-3 ${className}`}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-8 w-72 max-w-full" />
      <Skeleton className="h-4 w-full max-w-xl" />
    </div>
  );
}

export function SkeletonPage({
  label = "Loading the page",
  className = "",
  children,
}: ClassName & Readonly<{ label?: string; children: ReactNode }>) {
  return (
    <div role="status" aria-live="polite" data-skeleton="" className={`skeleton-in ${className}`}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  );
}
