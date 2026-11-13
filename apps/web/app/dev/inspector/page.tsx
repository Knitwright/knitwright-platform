import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { InspectorFixtures, type InspectorFixture } from "@/components/canvas/inspector/fixtures";
import { LaunchShell } from "@/components/launch/LaunchShell";
import { GARMENT_BOX, LINKED_BOX, type GarmentPreview } from "@/lib/canvas";
import { DEV_DESIGN, devGarmentView } from "@/lib/inspector/fixtures/dev";
import { board, link, project } from "@/lib/launch/fixtures/canvas";
import { SEEDED_EXPORT_TARGETS, SEEDED_WATERMARK_RULES } from "@/lib/marketing";
import { ALL_MOCKUP_SCENES } from "@/lib/mockups";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Inspector fixture", robots: { index: false, follow: false } };

/**
 * The right inspector by selection with made-up data (decision 0147), for the 1440 × 900 comparisons:
 *
 *   ?show=garment (e15) · info (e41) · text (e22) · image (e23) · illustration (e25) · group (e24)
 *   · mockup (e16) · edit (e26)
 *
 * It reads nothing and needs no session; a production build answers 404 unless DEV_UI_ROUTES is "on".
 * A change pressed here is not saved: the inspector says so.
 */

const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const GARMENT = id(1);
const MOCKUP = id(2);

const canvas = () => {
  const scene = ALL_MOCKUP_SCENES[0];
  const boards = [
    board(GARMENT, "garment", { name: "Home kit v7 · JSY-SS-01", at: { x: 0, y: 0 }, size: GARMENT_BOX, settings: { designProjectId: DEV_DESIGN }, inputVersion: 7 }),
    board(MOCKUP, "mockup", { name: "Flat lay on grass", at: { x: 440, y: 0 }, status: "ready", settings: { sceneSlug: scene?.slug ?? "" } }),
    board(id(3), "mockup", { name: "Team line-up (5)", at: { x: 440, y: 216 } }),
    board(id(5), "tech_pack", { name: "Tech pack · 16 pages", at: { x: 0, y: 460 }, size: LINKED_BOX }),
  ];
  const edges = [link("e1", GARMENT, MOCKUP), link("e2", GARMENT, id(3)), link("e5", GARMENT, id(5))];
  return project(boards, edges, { id: "00000000-0000-4000-8000-0000000000c1", name: "Lahore Lions · Home kit launch", designProjectId: DEV_DESIGN });
};

const preview: GarmentPreview = { designProjectId: DEV_DESIGN, name: "Home kit v7", version: 7, src: null, alt: "Home kit v7", checks: { passed: false, count: 1 } };

const ELEMENTS: Readonly<Record<string, string>> = { text: "text", image: "image", illustration: "illustration" };

export default async function DevInspectorPage({ searchParams }: PageProps<"/dev/inspector">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  const asked = (await searchParams).show;
  const show = typeof asked === "string" ? asked : "garment";
  const view = devGarmentView();
  const kind = ELEMENTS[show];
  const element = kind ? view.elements.find((one) => one.kind === kind)?.id : undefined;
  const fixture: InspectorFixture = {
    garments: { [DEV_DESIGN]: view },
    openInfo: show === "info",
    elementId: element,
    select: show === "group" ? [GARMENT, MOCKUP] : undefined,
    editing: show === "edit" ? MOCKUP : undefined,
  };
  const selected = show === "mockup" || show === "edit" ? MOCKUP : GARMENT;
  return (
    <main className="min-h-dvh bg-bg p-4">
      <InspectorFixtures value={fixture}>
        <LaunchShell
          project={canvas()}
          presets={[]}
          credits={1240}
          costs={{ perGeneratedBoard: 20, note: "Made-up prices for the fixture.", ruleId: "R-GAP-000" }}
          state={{ rail: "templates", boardId: selected, image: false, tool: "select", unit: "px", zoom: 75 }}
          canEdit
          marketing={{ voice: null, targets: SEEDED_EXPORT_TARGETS, watermarkRules: SEEDED_WATERMARK_RULES }}
          garments={{ [DEV_DESIGN]: preview }}
        />
      </InspectorFixtures>
    </main>
  );
}
