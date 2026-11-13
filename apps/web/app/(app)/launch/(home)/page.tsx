import type { Metadata, Route } from "next";
import Link from "next/link";
import { NewLaunchProject, type DesignChoice } from "@/components/launch/NewLaunchProject";
import { PageIntro } from "@/components/shell/PageIntro";
import { can } from "@/lib/clubs/roles";
import { UNIT_LABELS, launchProjectPath } from "@/lib/launch";
import { loadLaunchHome } from "@/lib/launch/server";
import { listProjects } from "@/lib/projects/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Launch" };

/**
 * The brand's launch projects (spec Launch section). A launch project is a canvas of boards: the
 * design, its mockups, its AI scenes, its clips, its posts and its info cards.
 *
 * This page sits in a `(home)` group, as the studio home does, so that its `loading.tsx` covers it
 * alone. A loading file on the `launch` segment itself would cover `[launchProjectId]` too, and a
 * flushed shell takes away that page's ability to answer 404 for a canvas that does not exist.
 *
 * The garment is always locked: every board starts from a Design board, which is a design version
 * the platform drew, so a model only ever changes the scene around it (spec decision 13).
 */
export default async function LaunchPage() {
  const { brand } = await requireMember();
  const client = await sessionClient();
  const [home, designs] = await Promise.all([loadLaunchHome(client, brand.id), listProjects(client, brand.id, 50)]);
  const canEdit = can(brand.role, "manageKit");
  const choices: readonly DesignChoice[] = designs.projects.map((one) => ({ id: one.id, name: one.name, version: one.currentVersion }));

  return (
    <div className="flex flex-col gap-8">
      <PageIntro
        eyebrow={`${brand.name} · launch`}
        title="Launch projects"
        lead="One canvas per launch: the design, its mockups, its scenes, its clips and its posts, joined by connectors. Every picture starts from the design the platform drew, so the garment in it is the garment you will make."
      />

      <NewLaunchProject designs={choices} canEdit={canEdit} />

      {home.projects.length === 0 ? (
        <section aria-label="No launch projects yet" className="flex flex-col gap-2 rounded-2xl border border-dashed border-hairline p-6">
          <h2 className="text-lg font-medium tracking-[-0.02em] text-ink">No launch project yet</h2>
          <p className="max-w-xl text-[15px] leading-relaxed text-muted">
            {brand.name} has nothing to launch yet. Name a launch above and pick the design it is for, and the canvas opens with a
            Design board for it already on it.
          </p>
        </section>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-hairline bg-surface">
          <table className="w-full min-w-[32rem] text-left text-[15px]">
            <caption className="sr-only">The launch projects of {brand.name}</caption>
            <thead>
              <tr className="border-b border-hairline text-sm text-muted">
                <th scope="col" className="px-4 py-3 font-medium">Launch</th>
                <th scope="col" className="px-4 py-3 font-medium">Boards</th>
                <th scope="col" className="px-4 py-3 font-medium">Units</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Delete</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline">
              {home.projects.map((one, at) => (
                <tr key={one.id}>
                  <th scope="row" className="px-4 py-3 font-medium">
                    <Link href={launchProjectPath(one.id) as Route} className="soft-link text-cobalt-soft">
                      {one.name}
                    </Link>
                  </th>
                  <td className="px-4 py-3 text-muted">{one.boards === 1 ? "1 board" : `${one.boards} boards`}</td>
                  <td className="px-4 py-3 text-muted">{UNIT_LABELS[one.units]}</td>
                  <td className="px-4 py-3 text-right">
                    {/*
                     * "Delete row 3", not "Delete <the launch's name>": the row is already named by
                     * its header, and a link whose name contains the row's own name makes every
                     * other link in that row ambiguous -- which is how this one broke the launch
                     * list's own test. The roster table names its per-row Remove the same way
                     * (`components/production/orders/RosterTable.tsx`).
                     */}
                    {canEdit ? (
                      <Link href={`/launch/${encodeURIComponent(one.id)}/delete` as Route} className="soft-link text-ink underline underline-offset-4">
                        Delete<span className="sr-only"> row {at + 1}</span>
                      </Link>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-[13px] leading-relaxed text-muted">
        {home.presets.length === 0
          ? "No artboard size is on file yet, so a board starts at 1080 by 1080 pixels until one is added."
          : `${home.presets.length} artboard sizes are on file. Every one is a labelled default nobody has reviewed, and the inspector says so beside it.`}{" "}
        <Link href="/projects/recent" className="soft-link text-ink underline underline-offset-4">
          Back to your designs
        </Link>
      </p>
    </div>
  );
}
