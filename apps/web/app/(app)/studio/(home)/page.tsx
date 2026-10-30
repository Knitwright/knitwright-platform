import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense, type CSSProperties } from "react";
import { DesignCard } from "@/components/home/DesignCard";
import { CardArtSkeleton, CardStepSkeleton, NeedsYouSkeleton } from "@/components/home/HomeSkeleton";
import { StreamedCardArt, StreamedCardStep, StreamedNeedsYou } from "@/components/home/HomeStreamed";
import { JourneyPanel } from "@/components/home/NeedsYouPanel";
import { ActionCards } from "@/components/studio/home/ActionCards";
import { JumpBackIn, TypeTag } from "@/components/studio/home/JumpBackIn";
import { Pagination } from "@/components/ui/Pagination";
import { greetingFor } from "@/lib/home/greeting";
import { chipFromQuery, DESIGN_TAG } from "@/lib/home/jump-back-in";
import { loadStudioHome } from "@/lib/home/load";
import { changedWhen } from "@/lib/home/when";
import { pageCount, pageHref, pageRequest, type PageRequest } from "@/lib/pagination/pages";
import type { ProjectSummary } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Studio" };

/** How many designs one page of the studio shows. */
const DESIGNS_PER_PAGE = 12;

type Home = ReturnType<typeof loadStudioHome>;

/**
 * The studio home (spec F-S4): the greeting, the action cards, what is waiting on the member, and
 * "Jump back in" with its filter chips and type tags. Every read starts at once; the page is sent
 * as soon as the page of designs is read, and each card's drawing and step, and the "Needs you"
 * list, fill in when they are ready.
 */
export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const request = pageRequest(query, DESIGNS_PER_PAGE);
  const now = new Date();
  const home = loadStudioHome(await sessionClient(), brand, request, now);
  const { projects, total } = await home.listing;
  const totalPages = pageCount(total, request.perPage);
  if (projects.length === 0 && request.page > totalPages) redirect(pageHref("/studio", totalPages) as Route);

  return (
    <>
      <div className="rise flex flex-col gap-1" style={{ "--i": 1 } as CSSProperties}>
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{brand.name}</p>
        <h1 className="text-4xl font-medium leading-none tracking-[-0.04em] text-ink sm:text-5xl">
          {greetingFor(now.getHours(), brand.name)}
        </h1>
      </div>
      <div className="rise" style={{ "--i": 2 } as CSSProperties}>
        <ActionCards />
      </div>
      <div className="rise" style={{ "--i": 3 } as CSSProperties}>
        {total === 0 ? (
          <JourneyPanel />
        ) : (
          <Suspense fallback={<NeedsYouSkeleton />}>
            <StreamedNeedsYou details={home.details} />
          </Suspense>
        )}
      </div>
      <JumpBackIn chip={chipFromQuery(query.jump)}>
        <Designs home={home} projects={projects} total={total} request={request} totalPages={totalPages} brandName={brand.name} now={now} />
      </JumpBackIn>
    </>
  );
}

type DesignsProps = Readonly<{
  home: Home;
  projects: readonly ProjectSummary[];
  total: number;
  request: PageRequest;
  totalPages: number;
  brandName: string;
  now: Date;
}>;

/** One page of the brand's designs, each with its type tag, its step and when it last changed. */
function Designs({ home, projects, total, request, totalPages, brandName, now }: DesignsProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="font-mono text-[13px] text-muted">
        {total === 1 ? "1 design" : `${total} designs`}
        {totalPages > 1 ? `, page ${request.page} of ${totalPages}` : ""}
      </p>
      {total === 0 ? (
        <FirstDesign brandName={brandName} />
      ) : (
        <ul aria-label={`Designs of ${brandName}, newest first`} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project, index) => (
            <li key={project.id} className="rise flex flex-col gap-2" style={{ "--i": Math.min(index, 8) + 3 } as CSSProperties}>
              <TypeTag label={DESIGN_TAG.label} />
              <DesignCard
                card={{ ...project, changed: changedWhen(project.updatedAt, now) }}
                art={
                  <Suspense fallback={<CardArtSkeleton />}>
                    <StreamedCardArt details={home.details} id={project.id} />
                  </Suspense>
                }
                step={
                  <Suspense fallback={<CardStepSkeleton />}>
                    <StreamedCardStep details={home.details} id={project.id} />
                  </Suspense>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <Pagination path="/studio" page={request.page} totalPages={totalPages} label="Pages of designs" />
    </div>
  );
}

/** The empty state of a new brand: a dashed tile where the first design will be. */
function FirstDesign({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div className="glass flex flex-col gap-3 rounded-[2rem] border-dashed p-6 sm:col-span-2">
        <h3 className="text-lg font-medium tracking-[-0.01em] text-ink">Start your first design</h3>
        <p className="text-[15px] leading-relaxed text-ink-2">
          Press + New, or pick a card above. Your designs show up here, each with the step it has reached and when it
          was last changed.
        </p>
        <p className="text-[13px] text-muted">Only members of {brandName} can see your designs.</p>
      </div>
    </div>
  );
}
