import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { DesignCard } from "@/components/home/DesignCard";
import { JourneyPanel, NeedsYouPanel } from "@/components/home/NeedsYouPanel";
import { StartWays } from "@/components/home/StartWays";
import { Pagination } from "@/components/ui/Pagination";
import { loadStudioHome } from "@/lib/home/load";
import { pageCount, pageHref, pageRequest } from "@/lib/pagination/pages";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Your designs" };

/** How many designs one page of the studio shows. */
const DESIGNS_PER_PAGE = 12;

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const { brand } = await requireMember();
  const request = pageRequest(await searchParams, DESIGNS_PER_PAGE);
  const home = await loadStudioHome(await sessionClient(), brand, request, new Date());
  const totalPages = pageCount(home.total, request.perPage);
  if (home.cards.length === 0 && request.page > totalPages) redirect(pageHref("/studio", totalPages) as Route);

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-12 lg:gap-[18px]">
        <div className="rise lg:col-span-7" style={{ "--i": 1 } as CSSProperties}>
          <StartWays brandName={brand.name} />
        </div>
        <div className="rise lg:col-span-5" style={{ "--i": 2 } as CSSProperties}>
          {home.total === 0 ? <JourneyPanel /> : <NeedsYouPanel needs={home.needsYou} />}
        </div>
      </div>

      <section aria-labelledby="designs" className="mt-10">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <h2 id="designs" className="text-3xl font-medium tracking-[-0.03em] text-ink">
            Your designs
          </h2>
          <p className="font-mono text-[13px] text-muted">
            {home.total === 1 ? "1 design" : `${home.total} designs`}
            {totalPages > 1 ? `, page ${request.page} of ${totalPages}` : ""}
          </p>
        </div>
        {home.total === 0 ? (
          <FirstDesign brandName={brand.name} />
        ) : (
          <ul aria-label={`Designs of ${brand.name}, newest first`} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {home.cards.map((card, index) => (
              <li key={card.id} className="rise" style={{ "--i": Math.min(index, 8) + 3 } as CSSProperties}>
                <DesignCard card={card} />
              </li>
            ))}
          </ul>
        )}
        <Pagination path="/studio" page={request.page} totalPages={totalPages} label="Pages of designs" />
      </section>
    </>
  );
}

/** The empty state of a new brand: a dashed tile where the first design will be. */
function FirstDesign({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="glass flex flex-col gap-3 rounded-[2rem] border-dashed p-6 sm:col-span-2">
        <h3 className="text-lg font-medium tracking-[-0.01em] text-ink">Start your first design</h3>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Pick one of the two ways in above. Your designs show up here, each with the step it has reached and when it
          was last changed.
        </p>
        <p className="text-[13px] text-muted">Only members of {brandName} can see your designs.</p>
      </div>
    </div>
  );
}
