import type { Metadata } from "next";
import Link from "next/link";
import { LinkButton } from "@/components/ui/LinkButton";
import { formatDate } from "@/lib/projects/dates";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Your designs" };

const HEADINGS = ["Design", "Garment type", "Style number", "Season", "Version", "Last changed"] as const;

export default async function StudioPage() {
  const { brand } = await requireMember();
  const projects = await listProjects(await sessionClient(), brand.id);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-muted">{brand.name}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-ink">Your designs</h1>
        </div>
        {projects.length > 0 ? <LinkButton href="/studio/new">New design</LinkButton> : null}
      </header>

      {projects.length === 0 ? (
        <section
          aria-labelledby="empty"
          className="mt-8 max-w-xl rounded-2xl border border-hairline bg-surface p-6"
        >
          <h2 id="empty" className="text-base font-semibold text-ink">
            Start your first design
          </h2>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Pick a garment, say who it is for, and give it a name. Only members of {brand.name} can
            see your designs.
          </p>
          <div className="mt-5">
            <LinkButton href="/studio/new">New design</LinkButton>
          </div>
        </section>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-hairline bg-surface">
          <table className="w-full min-w-[40rem] text-left text-[15px]">
            <caption className="sr-only">Designs of {brand.name}, newest first</caption>
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
                    <Link
                      href={`/studio/${project.id}`}
                      className="text-cobalt underline-offset-4 hover:underline"
                    >
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
      )}
    </>
  );
}
