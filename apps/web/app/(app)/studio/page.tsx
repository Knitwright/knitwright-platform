import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatDate } from "@/lib/projects/dates";
import { PROJECTS_LISTED } from "@/lib/projects/limits";
import { listProjects, type ProjectSummary } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Your designs" };

const HEADINGS = ["Design", "Garment type", "Style number", "Season", "Version", "Last changed"] as const;

export default async function StudioPage() {
  const { brand } = await requireMember();
  const { projects, hasMore } = await listProjects(await sessionClient(), brand.id);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Your designs</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/studio/charts" className="rounded-md text-sm font-medium text-ink-2 underline-offset-4 hover:underline">
            Size charts
          </Link>
        </div>
      </header>
      {projects.length > 0 ? <StartChoices /> : null}
      {projects.length === 0 ? <FirstDesign brandName={brand.name} /> : <ProjectsTable brandName={brand.name} projects={projects} />}
      {hasMore ? (
        <p className="mt-4 text-sm text-muted">
          This list shows your newest {PROJECTS_LISTED} designs. Older designs are kept but are not listed here.
        </p>
      ) : null}
    </>
  );
}

function FirstDesign({ brandName }: Readonly<{ brandName: string }>) {
  return (
    <section aria-labelledby="empty" className="mt-8 max-w-xl rounded-2xl border border-hairline bg-surface p-6">
      <h2 id="empty" className="text-base font-semibold text-ink">
        Start your first design
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">
        Only members of {brandName} can see your designs.
      </p>
      <StartChoices />
    </section>
  );
}

/** The two ways to start a design, each with one line on what it does. The guided way comes first. */
function StartChoices() {
  return (
    <ul className="mt-5 flex flex-col gap-4 sm:flex-row sm:gap-8">
      <li className="flex max-w-sm flex-col gap-2">
        <div>
          <LinkButton href="/studio/start">Start a design</LinkButton>
        </div>
        <p className="text-sm leading-relaxed text-muted">
          Step by step, from your own words, a sketch or a garment, through to sharing it and a quote.
        </p>
      </li>
      <li className="flex max-w-sm flex-col gap-2">
        <div>
          <LinkButton href="/studio/new" variant="secondary">
            Blank design
          </LinkButton>
        </div>
        <p className="text-sm leading-relaxed text-muted">Pick a garment and go straight to the full editor.</p>
      </li>
    </ul>
  );
}

type ProjectsTableProps = Readonly<{ brandName: string; projects: readonly ProjectSummary[] }>;

function ProjectsTable({ brandName, projects }: ProjectsTableProps) {
  return (
    <div className="mt-8 overflow-x-auto rounded-2xl border border-hairline bg-surface">
      <table className="w-full min-w-[40rem] text-left text-[15px]">
        <caption className="sr-only">Designs of {brandName}, newest first</caption>
        <thead>
          <tr className="border-b border-hairline text-sm text-muted">
            {HEADINGS.map((heading) => (
              <th key={heading} scope="col" className="px-4 py-3 font-medium">
                {heading}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {projects.map((project) => (
            <tr key={project.id}>
              <th scope="row" className="px-4 py-3 font-medium text-ink">
                <Link href={`/studio/${project.id}`} className="text-cobalt underline-offset-4 hover:underline">
                  {project.name}
                </Link>
              </th>
              <td className="px-4 py-3 text-ink-2">{project.garmentLabel}</td>
              <td className="px-4 py-3 text-ink-2">{project.styleNumber || "None"}</td>
              <td className="px-4 py-3 text-ink-2">{project.season || "None"}</td>
              <td className="px-4 py-3 font-mono text-ink-2">{project.currentVersion}</td>
              <td className="px-4 py-3 text-ink-2">{formatDate(project.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
