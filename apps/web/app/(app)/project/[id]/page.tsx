import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { FocusedGarment } from "@/components/canvas/FocusedGarment";
import { LaunchShell } from "@/components/launch/LaunchShell";
import { GarmentEditor } from "@/components/studio/editor/GarmentEditor";
import { loadRecord } from "@/lib/brand-studio/service";
import { focusTarget, projectHref, readFocus } from "@/lib/canvas";
import { garmentPreviews, resolveCanvas } from "@/lib/canvas/server";
import { listBaseArticles } from "@/lib/catalogue";
import { can } from "@/lib/clubs/roles";
import { loadShelf, readFlyout, SHELF_DESIGNS } from "@/lib/editor-chrome";
import { listProjects } from "@/lib/projects/service";
import { launchPageState } from "@/lib/launch";
import { loadLaunchCanvas } from "@/lib/launch/server";
import { SEEDED_EXPORT_TARGETS, SEEDED_WATERMARK_RULES, voiceFromRecord } from "@/lib/marketing";
import { listExportTargets, listWatermarkRules } from "@/lib/marketing/service";
import { sessionClient } from "@/lib/server/deps";
import { requireMember } from "@/lib/server/page-guards";

export const metadata: Metadata = { title: "Project" };

/**
 * THE ONE CANVAS (plan v6 E1, decision 0145; `08` §5, screens 12–13). Every project opens here:
 * `<id>` is a launch canvas's id or a studio design's, which opens the design's home canvas.
 *
 * `?focus=garment` (or a garment board's id) opens that garment in the editor, in place: the same
 * address, the canvas behind it one click away. Without it, the canvas: boards on an infinite plane,
 * in the editor's Kittl chrome (E2, decision 0146): the labelled rail, the flyouts, the right panel and the dock.
 *
 * A project that is missing, or belongs to another brand, is a page that does not exist. There is
 * deliberately no `loading.tsx`: one would flush the frame before `notFound()` could set the 404.
 */
export default async function ProjectPage({ params, searchParams }: PageProps<"/project/[id]">) {
  const { brand } = await requireMember();
  const { id } = await params;
  const query = await searchParams;
  const client = await sessionClient();

  const record = await resolveCanvas(client, brand.id, id);
  if (record === null) notFound();
  const canvas = await loadLaunchCanvas(client, brand.id, record.canvasId);
  if (canvas === null) notFound();

  const focus = focusTarget(canvas.project.boards, record.studioProjectId, readFocus(query));
  if (focus !== null) {
    return (
      <FocusedGarment backHref={projectHref(id)} canvasName={canvas.project.name}>
        <GarmentEditor brandId={brand.id} projectId={focus.designProjectId} query={query} />
      </FocusedGarment>
    );
  }

  // The marketing panels' three outside reads (decision 0094), each falling back rather than taking
  // the canvas down; and what every garment board shows.
  const [targets, watermarkRules, brandRecord, garments, products] = await Promise.all([
    listExportTargets(client).catch(() => SEEDED_EXPORT_TARGETS),
    listWatermarkRules(client).catch(() => SEEDED_WATERMARK_RULES),
    loadRecord(client, { id: brand.id, name: brand.name }).catch(() => null),
    garmentPreviews(client, brand.id, canvas.project.boards),
    // The editor's Products flyout (decision 0146): the brand's designs and the catalogue's bases.
    loadShelf(
      async () => (await listProjects(client, brand.id, SHELF_DESIGNS)).projects,
      () => listBaseArticles(client),
    ),
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
      marketing={{ voice: brandRecord === null ? null : voiceFromRecord(brandRecord), targets, watermarkRules }}
      garments={garments}
      flyout={readFlyout(query)}
      products={products}
    />
  );
}
