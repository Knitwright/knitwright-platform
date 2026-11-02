import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { LaunchShell } from "@/components/launch/LaunchShell";
import { loadRecord } from "@/lib/brand-studio/service";
import { can } from "@/lib/clubs/roles";
import { launchPageState } from "@/lib/launch";
import { loadLaunchCanvas } from "@/lib/launch/server";
import { SEEDED_EXPORT_TARGETS, SEEDED_WATERMARK_RULES, voiceFromRecord } from "@/lib/marketing";
import { listExportTargets, listWatermarkRules } from "@/lib/marketing/service";
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
 *
 * The marketing panels (L4, decision 0094) need three things the canvas does not carry: the brand's
 * voice and tone, the export targets and the watermark rules. They are read here, and each read
 * falls back rather than taking the canvas down with it -- the seeded rows a test holds to the
 * migration's own, and no voice, which the panels already say plainly.
 */
export default async function LaunchProjectPage({ params, searchParams }: PageProps<"/launch/[launchProjectId]">) {
  const { brand } = await requireMember();
  const { launchProjectId } = await params;
  const query = await searchParams;
  const client = await sessionClient();
  const canvas = await loadLaunchCanvas(client, brand.id, launchProjectId);
  if (canvas === null) notFound();

  const [targets, watermarkRules, record] = await Promise.all([
    listExportTargets(client).catch(() => SEEDED_EXPORT_TARGETS),
    listWatermarkRules(client).catch(() => SEEDED_WATERMARK_RULES),
    loadRecord(client, { id: brand.id, name: brand.name }).catch(() => null),
  ]);

  const state = launchPageState({ query, project: canvas.project });

  return (
    <LaunchShell
      project={canvas.project}
      presets={canvas.presets}
      credits={canvas.credits}
      costs={canvas.costs}
      state={{ rail: state.rail, boardId: state.selection?.board.id ?? null, image: state.selection?.image ?? false, tool: state.tool, unit: state.unit, zoom: state.zoom }}
      canEdit={can(brand.role, "manageKit")}
      marketing={{ voice: record === null ? null : voiceFromRecord(record), targets, watermarkRules }}
    />
  );
}
