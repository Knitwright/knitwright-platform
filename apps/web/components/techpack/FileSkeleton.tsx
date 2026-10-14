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
