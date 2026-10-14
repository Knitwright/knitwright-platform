/**
 * Stand-ins for the parts of the studio home that are still on their way: a soft glow that
 * pulses gently, and stays still for anyone who asks their system for less motion.
 */

/** One grey bar or block in the shape of what is coming. */
export function Bone({ className = "" }: Readonly<{ className?: string }>) {
  return <span aria-hidden="true" className={`block rounded-full bg-white/[0.07] motion-safe:animate-pulse ${className}`} />;
}

/** Where a card's drawing goes. */
export function CardArtSkeleton() {
  return <Bone className="h-24 w-20 rounded-2xl! sm:h-32 sm:w-24" />;
}

/** Where a card's step goes. */
export function CardStepSkeleton() {
  return <Bone className="h-5 w-28" />;
}

/** The "Needs you" panel while the list is made. */
export function NeedsYouSkeleton() {
  return (
    <section aria-labelledby="needs-you" aria-busy="true" className="glass flex h-full flex-col gap-2.5 rounded-[2rem] p-5 sm:rounded-[2.5rem] sm:p-7">
      <h2 id="needs-you" className="font-mono text-xs uppercase tracking-[0.1em] text-muted">
        Needs you
      </h2>
      <p className="sr-only">Looking for what is waiting on you.</p>
      {[0, 1, 2].map((row) => (
        <span key={row} className="flex items-center gap-3.5 rounded-[1.25rem] border border-white/8 bg-white/[0.04] px-4 py-3.5">
          <Bone className="size-2.5 flex-none" />
          <Bone className="h-4 flex-1" />
          <Bone className="h-4 w-12" />
        </span>
      ))}
    </section>
  );
}

/** A card while the page of designs is read. */
function CardSkeleton() {
  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-[2rem]">
      <span className="dot-grid grid h-32 place-items-center border-b border-white/8 p-4 sm:h-40">
        <CardArtSkeleton />
      </span>
      <span className="flex flex-col gap-2.5 px-5 pb-5 pt-4">
        <Bone className="h-4 w-3/4" />
        <Bone className="h-3.5 w-1/2" />
        <span className="flex items-center justify-between gap-2 pt-4">
          <CardStepSkeleton />
          <Bone className="h-3.5 w-14" />
        </span>
      </span>
    </div>
  );
}

/** The whole studio home in outline: the start panel, "Needs you" and a grid of cards. */
export function HomeSkeleton() {
  return (
    <div aria-busy="true">
      <p className="sr-only" role="status">
        Opening your designs.
      </p>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-[18px]">
        <div className="glass flex min-h-72 flex-col gap-4 rounded-[2rem] p-6 sm:rounded-[2.5rem] sm:p-10 lg:col-span-7">
          <Bone className="h-3 w-24" />
          <Bone className="h-10 w-4/5 sm:h-14" />
          <Bone className="h-10 w-2/5 sm:h-14" />
          <span className="mt-auto grid gap-3 pt-6 sm:grid-cols-2">
            <Bone className="h-36 rounded-[1.6rem]!" />
            <Bone className="h-36 rounded-[1.6rem]!" />
          </span>
        </div>
        <div className="lg:col-span-5">
          <NeedsYouSkeleton />
        </div>
      </div>
      <div className="mt-10">
        <h2 className="text-3xl font-medium tracking-[-0.03em] text-ink">Your designs</h2>
        <ul aria-hidden="true" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((card) => (
            <li key={card}>
              <CardSkeleton />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
