import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaunchShell } from "@/components/launch/LaunchShell";
import { can } from "@/lib/clubs/roles";
import { launchPageState } from "@/lib/launch";
import { loadLaunchCanvas } from "@/lib/launch/server";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Launch project" };

/**
 * One launch canvas, in the launch shell (spec Launch section). A canvas that is missing, or
 * belongs to another brand, is a page that does not exist.
 *
 * There is deliberately no `loading.tsx` beside this page: a loading file flushes the shell before
 * the page runs, and `notFound()` can then no longer set a 404 (plan v5, the e2e traps). The
 * launch list has one instead.
 */
export default async function LaunchProjectPage({ params, searchParams }: PageProps<"/launch/[launchProjectId]">) {
  const { brand } = await requireMember();
  const { launchProjectId } = await params;
  const query = await searchParams;
  const canvas = await loadLaunchCanvas(await sessionClient(), brand.id, launchProjectId);
  if (canvas === null) notFound();

  const state = launchPageState({ query, project: canvas.project });

  return (
    <LaunchShell
      project={canvas.project}
      presets={canvas.presets}
      credits={canvas.credits}
      costs={canvas.costs}
      state={{ rail: state.rail, boardId: state.selection?.board.id ?? null, image: state.selection?.image ?? false, tool: state.tool, unit: state.unit, zoom: state.zoom }}
      canEdit={can(brand.role, "manageKit")}
    />
  );
}
