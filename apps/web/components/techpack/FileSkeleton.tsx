import { Bone } from "@/components/home/HomeSkeleton";

/**
 * Stand-ins for the factory file while it is read: the same layout as the page, in soft bars
 * that pulse gently and stay still for anyone who asks their system for less motion.
 */

/** A drawing that is still on its way. */
export function DrawingSkeleton({ className = "" }: Readonly<{ className?: string }>) {
  return (
    <div aria-hidden="true" className={`grid place-items-center rounded-xl border border-hairline bg-white/[0.04] p-6 ${className}`}>
      <Bone className="h-40 w-32 rounded-2xl!" />
    </div>
  );
}

/** The two drawings of the flats while the artwork's pictures are read. */
export function FlatPicturesSkeleton() {
  return (
    <div aria-busy="true" className="grid gap-4 sm:grid-cols-2">
      <p className="sr-only">Drawing the flats.</p>
      <DrawingSkeleton />
      <DrawingSkeleton />
    </div>
  );
}

/** The body of a section whose content is still on its way. */
export function BodySkeleton({ what }: Readonly<{ what: string }>) {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p className="sr-only">{`Opening ${what}.`}</p>
      <Bone className="h-4 w-2/3" />
      <Bone className="h-4 w-1/2" />
      <Bone className="h-24 w-full rounded-2xl!" />
    </div>
  );
}

const NAV_ROWS = 12;
const TABLE_ROWS = 6;

/** The whole factory file in outline: the header, the list of sections with its ring, and one section. */
export function FileSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col gap-4">
      <p className="sr-only" role="status">
        Opening the factory file.
      </p>
      <div className="glass flex flex-col gap-4 rounded-3xl p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <Bone className="h-4 w-32" />
          <div className="flex min-w-0 flex-col gap-2">
            <Bone className="h-3 w-40" />
            <Bone className="h-7 w-56" />
            <Bone className="h-3.5 w-20" />
          </div>
          <Bone className="h-9 w-full max-w-md lg:ml-auto lg:w-96" />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Bone className="h-4 w-36" />
          {[0, 1, 2, 3, 4].map((button) => (
            <Bone key={button} className="h-9 w-24" />
          ))}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start">
        <div className="glass flex min-w-0 flex-col gap-4 rounded-3xl p-4 sm:p-5">
          <div className="flex items-center gap-3.5">
            <Bone className="size-16 shrink-0" />
            <div className="flex flex-1 flex-col gap-2">
              <Bone className="h-7 w-16" />
              <Bone className="h-3 w-full" />
            </div>
          </div>
          <Bone className="h-11 w-full" />
          <div className="hidden flex-col gap-2.5 lg:flex">
            {Array.from({ length: NAV_ROWS }, (_, row) => (
              <Bone key={row} className="h-8 w-full rounded-xl!" />
            ))}
          </div>
          <Bone className="h-11 w-full rounded-xl! lg:hidden" />
        </div>
        <div className="glass flex min-w-0 flex-col gap-4 rounded-3xl p-6">
          <Bone className="h-7 w-48" />
          <Bone className="h-4 w-3/4" />
          {Array.from({ length: TABLE_ROWS }, (_, row) => (
            <Bone key={row} className="h-9 w-full rounded-lg!" />
          ))}
        </div>
      </div>
    </div>
  );
}
