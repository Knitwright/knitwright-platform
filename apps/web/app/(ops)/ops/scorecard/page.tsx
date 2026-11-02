import type { Metadata } from "next";
import { Suspense } from "react";
import { ScorecardTable } from "@/components/ops/ScorecardTable";
import { SkeletonPanel } from "@/components/ui/Skeleton";
import { loadScorecards } from "@/lib/ops/scorecard/service";
import { adminClient, sessionClient } from "@/lib/server/deps";
import { requirePlatformAdmin } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Ops: factory scorecard", robots: { index: false, follow: false } };

/** The cards, counted while the page streams. Everything it reads is already behind the guard above it. */
async function Cards() {
  const { cards, truncated } = await loadScorecards(await sessionClient(), adminClient());
  return (
    <>
      {truncated ? (
        <p className="mb-4 text-sm text-warn">
          There are more rows than one card can count. These figures cover the newest rows only.
        </p>
      ) : null}
      <ScorecardTable cards={cards} />
    </>
  );
}

/**
 * The per-factory scorecard (F-O6). On-time, defects in the sample, colour inside tolerance, remakes and the
 * golden sample of each article, counted from rows. A factory is active only with a golden sample signed off,
 * and its card says so at a glance.
 */
export default async function ScorecardPage() {
  await requirePlatformAdmin();
  return (
    <main id="main" className="rise">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">Factory scorecard</h1>
      <p className="mt-1 max-w-3xl text-[15px] text-muted">
        Counted from the orders, inspections, parcels and remakes on file. A rate with nothing behind it reads &quot;nothing counted
        yet&quot; rather than a score. No delivery date appears anywhere on this platform: the days for QC and the freight days are
        not set, so none can be worked out.
      </p>
      <section aria-labelledby="factories" className="mt-6">
        <h2 id="factories" className="sr-only">
          Factories
        </h2>
        <Suspense
          fallback={
            <div aria-busy="true" aria-live="polite" className="flex flex-col gap-4">
              <span className="sr-only">Counting the factory scorecards</span>
              <SkeletonPanel className="h-40" />
              <SkeletonPanel className="h-40" />
            </div>
          }
        >
          <Cards />
        </Suspense>
      </section>
    </main>
  );
}
