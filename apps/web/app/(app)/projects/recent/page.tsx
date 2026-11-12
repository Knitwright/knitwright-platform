import type { Metadata, Route } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { DesignCard } from "@/components/home/DesignCard";
import { CardArtSkeleton, CardStepSkeleton, NeedsYouSkeleton } from "@/components/home/HomeSkeleton";
import { StreamedCardArt, StreamedCardStep, StreamedNeedsYou } from "@/components/home/HomeStreamed";
import { JourneyPanel } from "@/components/home/NeedsYouPanel";
import { StartCards } from "@/components/projects/v3/StartCards";
import { JumpBackIn, TypeTag } from "@/components/studio/home/JumpBackIn";
import { Pagination } from "@/components/ui/Pagination";
import { greetingFor } from "@/lib/home/greeting";
import { chipFromQuery, DESIGN_TAG } from "@/lib/home/jump-back-in";
import { loadStudioHome } from "@/lib/home/load";
import { changedWhen } from "@/lib/home/when";
import { pageCount, pageHref, pageRequest, type PageRequest } from "@/lib/pagination/pages";
import { RECENT_PATH } from "@/lib/projects-page/paths";
import type { ProjectSummary } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Recent" };

/** How many designs one page of Recent shows. */
const DESIGNS_PER_PAGE = 12;

type Home = ReturnType<typeof loadStudioHome>;

/**
 * Recent (09 screen 14; 08 v3.6 "Projects home", d02), moved here from the v2.2 studio home at
 * `/studio`, which redirects to it: the greeting, the dashed start cards, what is waiting on the
 * member, and "Jump back in" with its chips and type tags. Every read starts at once; the page is
 * sent as soon as the page of designs is read, and each card's drawing and step, and "Needs you",
 * fill in when they are ready.
 */
export default async function RecentPage({ searchParams }: PageProps<"/projects/recent">) {
  const { brand } = await requireMember();
  const query = await searchParams;
  const request = pageRequest(query, DESIGNS_PER_PAGE);
  const now = new Date();
  const home = loadStudioHome(await sessionClient(), brand, request, now);
  const { projects, total } = await home.listing;
  const totalPages = pageCount(total, request.perPage);
  if (projects.length === 0 && request.page > totalPages) redirect(pageHref(RECENT_PATH, totalPages) as Route);

  return (
    <>
      <h1 className="text-h1 text-text">{greetingFor(now.getHours(), brand.name)}</h1>
      <StartCards />
      {total === 0 ? (
        <JourneyPanel />
      ) : (
        <Suspense fallback={<NeedsYouSkeleton />}>
          <StreamedNeedsYou details={home.details} />
        </Suspense>
      )}
      <JumpBackIn chip={chipFromQuery(query.jump)} path={RECENT_PATH}>
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
      <p className="text-small text-muted">
        {total === 1 ? "1 design" : `${total} designs`}
        {totalPages > 1 ? `, page ${request.page} of ${totalPages}` : ""}
      </p>
      {total === 0 ? (
        <FirstDesign brandName={brandName} />
      ) : (
        <ul aria-label={`Designs of ${brandName}, newest first`} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {projects.map((project) => (
            <li key={project.id} className="flex flex-col gap-2">
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
      <Pagination path={RECENT_PATH} page={request.page} totalPages={totalPages} label="Pages of designs" />
    </div>
  );
}

/** The empty state of a new brand: a dashed tile where the first design will be. */
function FirstDesign({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-dashed border-border-strong p-6">
      <h3 className="text-h3 text-text">Start your first design</h3>
      <p className="text-body text-text-2">
        Press Start designing, or pick a card above. Your designs show up here, each with the step it has reached and when it was
        last changed.
      </p>
      <p className="text-small text-muted">Only members of {brandName} can see your designs.</p>
    </div>
  );
}
