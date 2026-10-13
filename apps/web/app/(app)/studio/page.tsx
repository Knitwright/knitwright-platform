import type { Metadata, Route } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { CSSProperties } from "react";
import { DesignTile } from "@/components/studio/DesignTile";
import { ArrowMark } from "@/components/ui/ArrowMark";
import { Pagination } from "@/components/ui/Pagination";
import { pageCount, pageHref, pageRequest } from "@/lib/pagination/pages";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Your designs" };

/** How many designs one page of the studio shows. */
const DESIGNS_PER_PAGE = 12;

const WAYS = [
  {
    href: "/studio/start",
    title: "Start a design, step by step",
    text: "Pick a garment, then the fit, the colours and the sizes, one question at a time.",
  },
  {
    href: "/studio/new",
    title: "New design",
    text: "Name it and pick the garment. You go straight to the editor.",
  },
] as const satisfies readonly { href: Route; title: string; text: string }[];

export default async function StudioPage({ searchParams }: PageProps<"/studio">) {
  const { brand } = await requireMember();
  const request = pageRequest(await searchParams, DESIGNS_PER_PAGE);
  const { projects, total } = await listProjects(await sessionClient(), brand.id, request.perPage, request.offset);
  const totalPages = pageCount(total, request.perPage);
  if (projects.length === 0 && request.page > totalPages) redirect(pageHref("/studio", totalPages) as Route);

  return (
    <>
      <section aria-labelledby="start" className="glass rounded-[2rem] p-6 sm:rounded-[2.5rem] sm:p-10">
        <p className="font-mono text-xs uppercase tracking-[0.1em] text-muted">{brand.name}</p>
        <h1 id="start" className="mt-4 text-4xl font-medium leading-none tracking-[-0.04em] text-ink sm:text-6xl">
          Start your next kit.
          <br />
          <span className="morph-reveal thread-text pb-[0.08em]">Two ways in.</span>
        </h1>
        <ul className="mt-8 grid gap-3 sm:grid-cols-2">
          {WAYS.map((way, index) => (
            <li key={way.href} className="rise" style={{ "--i": index + 2 } as CSSProperties}>
              <Link
                href={way.href}
                className="lift flex min-h-36 flex-col gap-4 rounded-[1.6rem] border border-white/12 bg-white/5 p-5 text-ink no-underline"
              >
                <span className="fill-layer" aria-hidden="true" />
                <span className="flex items-center justify-between gap-4">
                  <span className="text-lg font-medium tracking-[-0.01em]">{way.title}</span>
                  <span className="chip-disc size-9 bg-white" aria-hidden="true">
                    <ArrowMark />
                  </span>
                </span>
                <span className="mt-auto text-[13.5px] leading-relaxed text-ink-2">{way.text}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="designs" className="mt-10">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <h2 id="designs" className="text-3xl font-medium tracking-[-0.03em] text-ink">
            Your designs
          </h2>
          <p className="font-mono text-[13px] text-muted">
            {total === 1 ? "1 design" : `${total} designs`}
            {totalPages > 1 ? `, page ${request.page} of ${totalPages}` : ""}
          </p>
        </div>
        {projects.length === 0 ? (
          <FirstDesign brandName={brand.name} />
        ) : (
          <ul aria-label={`Designs of ${brand.name}, newest first`} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {projects.map((project, index) => (
              <li key={project.id} className="rise" style={{ "--i": Math.min(index, 8) } as CSSProperties}>
                <DesignTile project={project} />
              </li>
            ))}
          </ul>
        )}
        <Pagination path="/studio" page={request.page} totalPages={totalPages} label="Pages of designs" />
      </section>
    </>
  );
}

function FirstDesign({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <div className="glass mt-5 max-w-xl rounded-[1.75rem] p-6">
      <h3 className="text-base font-medium text-ink">Start your first design</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Pick one of the two ways in above. Only members of {brandName} can see your designs.
      </p>
    </div>
  );
}
