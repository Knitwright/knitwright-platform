import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { LaunchShell } from "@/components/launch/LaunchShell";
import { GARMENT_BOX, LINKED_BOX, type GarmentPreview } from "@/lib/canvas";
import { start } from "@/lib/garment/fixtures/specs";
import { board, link, project } from "@/lib/launch/fixtures/canvas";
import { SEEDED_EXPORT_TARGETS, SEEDED_WATERMARK_RULES } from "@/lib/marketing";
import { flatPreview } from "@/lib/projects/flat-preview";
import { MADE_UP_CHART_SET } from "@/lib/sizing/fixtures/made-up-charts";
import { devRoutesEnabled } from "../dev-routes";

export const metadata: Metadata = { title: "Canvas fixture", robots: { index: false, follow: false } };

/**
 * The one canvas with made-up data (decision 0145), for the 1440 × 900 comparison with e01: a
 * Garment board feeding two mockups, an AI image, a tech pack and an order, on the infinite plane.
 * It reads nothing and needs no session; a production build answers 404 unless DEV_UI_ROUTES is
 * "on". Pressing a board's run or Add… here calls the real actions, which refuse without a session.
 */

const DESIGN = "00000000-0000-4000-8000-0000000000d1";

const garmentPreview = (): GarmentPreview => {
  const front = flatPreview(start("crew-tee"), new Map(), MADE_UP_CHART_SET)?.views[0] ?? null;
  return {
    designProjectId: DESIGN,
    name: "Home kit v7",
    version: 7,
    src: front?.src ?? null,
    alt: front?.alt ?? "Home kit v7",
    checks: { passed: false, count: 1 },
  };
};

const fixture = () => {
  const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
  const boards = [
    board(id(1), "garment", { name: "Home kit v7 · JSY-SS-01", at: { x: 0, y: 0 }, size: GARMENT_BOX, settings: { designProjectId: DESIGN }, inputVersion: 7 }),
    board(id(2), "mockup", { name: "Flat lay on grass", at: { x: 440, y: 0 }, status: "ready" }),
    board(id(3), "mockup", { name: "Team line-up (5)", at: { x: 440, y: 216 } }),
    board(id(4), "ai_image", { name: "Floodlit pitch", at: { x: 800, y: 96 } }),
    board(id(5), "tech_pack", { name: "Tech pack · 16 pages", at: { x: 0, y: 460 }, size: LINKED_BOX }),
    board(id(6), "order", { name: "Order · Sample (S, M, XL)", at: { x: 440, y: 460 }, size: LINKED_BOX }),
  ];
  const edges = [link("e1", id(1), id(2)), link("e2", id(1), id(3)), link("e3", id(2), id(4)), link("e4", id(3), id(4), 2), link("e5", id(1), id(5)), link("e6", id(1), id(6))];
  return project(boards, edges, { id: "00000000-0000-4000-8000-0000000000c1", name: "Lahore Lions · Home kit launch", designProjectId: DESIGN });
};

/** `?stack=1`: four boards added from the inspector's tools, each a row below the last (`placing.ts`). */
const stacked = () =>
  project(
    (["ai_image", "marketing", "ai_video", "info_card"] as const).map((kind, n) => board(`00000000-0000-4000-8000-00000000001${n}`, kind, { at: { x: 0, y: n * 200 } })),
    [],
    { id: "00000000-0000-4000-8000-0000000000c2", name: "Stacked boards" },
  );

export default async function DevCanvasPage({ searchParams }: PageProps<"/dev/canvas">) {
  await connection();
  if (!devRoutesEnabled(process.env)) notFound();
  return (
    <main className="min-h-dvh bg-bg p-4">
      <LaunchShell
        project={(await searchParams).stack ? stacked() : fixture()}
        presets={[]}
        credits={1240}
        costs={{ perGeneratedBoard: 20, note: "Made-up prices for the fixture.", ruleId: "R-GAP-000" }}
        state={{ rail: "templates", boardId: null, image: false, tool: "select", unit: "px", zoom: 75 }}
        canEdit
        marketing={{ voice: null, targets: SEEDED_EXPORT_TARGETS, watermarkRules: SEEDED_WATERMARK_RULES }}
        garments={{ [DESIGN]: garmentPreview() }}
      />
    </main>
  );
}
