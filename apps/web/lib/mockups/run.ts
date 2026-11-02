import type { ImageMap } from "@/lib/flat/images";
import type { GarmentSpec } from "@/lib/garment";
import { garmentSource, runnable, type AssetFile, type BoardStatus, type BoardView, type Graph, type LaunchAsset } from "@/lib/launch";
import type { ChartSet } from "@/lib/sizing";
import { drawnAsset } from "./assets";
import { colourwayForRole, sceneSlugOf, settingsFrom } from "./board";
import { AI_SCENE_REFUSED, composeMockup } from "./compose";
import { drawGarment, NO_DRAWING_LINE } from "./garment";
import { sceneBySlug } from "./scenes";
import { MOCKUP_GAP_RULE, type KitRole, type MockupScene } from "./types";

/**
 * DRAWING A MOCKUP BOARD, AND RECORDING WHAT IT DREW (the wiring of decision 0092).
 *
 * L2 built the renderer (`compose.ts`, `paint.ts`, `garment.ts`) and a panel that asks for a run
 * through `requestRun`, which is all L1's contract allows a panel to do. This is the half that was
 * missing: read the design version behind the board, draw, store the file, and hand it to L1's one
 * writer.
 *
 * **It is free and it is deterministic**, so no credit is reserved and no model is called. The same
 * board, the same design version and the same settings give the same bytes every time.
 *
 * **The garment lock is not worked around here, it is asked for.** Three things make that true:
 *
 *   * `runnable` is asked first, so a board with no Design board behind it is refused with L1's own
 *     sentence before anything is drawn -- the same check the shell makes and the same one
 *     `set_launch_board_output` makes in the database;
 *   * the garment comes from `garmentSource`, which walks the connectors back to the Design board,
 *     so the picture is of the design the platform drew and of no other;
 *   * what is handed to the writer is a `DrawnAsset` from `drawnAsset`, whose provenance is the
 *     literal `"deterministic"`. There is no path through this file that can produce a generated
 *     asset, so it cannot become a fourth way round the lock.
 *
 * Every read, every write and every store is a dependency, so the whole of it is tested without a
 * database, a bucket or a design (`run.test.ts`). `actions.ts` is the file that supplies the real
 * ones.
 */

/** The design version a board draws from: the garment, the charts it is measured by, its pictures. */
export interface DesignToDraw {
  readonly spec: GarmentSpec;
  readonly charts: ChartSet;
  readonly images: ImageMap;
  /** The version actually read, which is what the board records as its input. */
  readonly version: number;
}

export interface RenderDeps {
  /** The design version behind the board, or null when it cannot be read. */
  readonly design: (designProjectId: string, version: number | null) => Promise<DesignToDraw | null>;
  /** Stores the PNG and answers with the file it became. */
  readonly store: (png: Uint8Array) => Promise<AssetFile>;
  /** L1's one door to a board's output (`recordOutput`, decision 0091). */
  readonly record: (
    input: Readonly<{ boardId: string; kind: BoardView["kind"]; asset: LaunchAsset | null; status: BoardStatus; credits: number | null }>,
  ) => Promise<void>;
  /** Writes the design version this board was drawn from, so a later version reads as stale. */
  readonly setInputVersion: (board: BoardView, version: number) => Promise<void>;
}

export type RenderOutcome =
  | Readonly<{ ok: true; fileId: string; width: number; height: number; notes: readonly string[]; gaps: readonly string[] }>
  | Readonly<{ ok: false; reason: string; ruleId: string }>;

const refuse = (reason: string): RenderOutcome => ({ ok: false, reason, ruleId: MOCKUP_GAP_RULE });

export const NO_SCENE_LINE = "This board has no scene yet, so there is nothing to draw. Pick one in the Mockups panel.";
export const NO_DESIGN_LINE = "The Design board behind this one has no design on it, so there is no garment to draw.";
export const UNREADABLE_LINE = "That design version could not be read, so nothing was drawn.";
export const CHART_SCENE_LINE =
  "This scene draws a size or colour chart card, and the card is not wired to the design's own measurements yet, so nothing was drawn.";

/** A scene that draws a chart card instead of a garment. `composeMockup` needs the card drawn first. */
const drawsChart = (scene: MockupScene): boolean => scene.card !== null || scene.slots.some((slot) => slot.presentation === "chart");

/**
 * The colourway a board draws: the one it names, or the one of the design whose name matches its
 * kit role (`colourwayForRole`, which invents nothing and answers null for a design that names
 * none). Null leaves it to the design's own first colourway.
 */
const colourwayFor = (spec: GarmentSpec, settings: Readonly<{ colourwayId: string | null; kitRole: KitRole }>): string | null =>
  settings.colourwayId ?? colourwayForRole(settings.kitRole, spec.colourways);

/**
 * Draws one mockup board and records the picture as its output. Nothing is written until the
 * drawing is in storage, so a refusal leaves the board exactly as it was.
 */
export async function renderMockupBoard(deps: RenderDeps, graph: Graph, boardId: string): Promise<RenderOutcome> {
  const board = graph.boards.find((one) => one.id === boardId) ?? null;
  if (board === null || board.kind !== "mockup") return refuse("That is not a mockup board.");

  const verdict = runnable(graph, boardId);
  if (!verdict.canRun) return { ok: false, reason: verdict.reason, ruleId: verdict.ruleId };

  const scene = sceneBySlug(sceneSlugOf(board.settings) ?? "");
  if (scene === null) return refuse(NO_SCENE_LINE);
  if (scene.source !== "deterministic") return refuse(AI_SCENE_REFUSED);
  if (drawsChart(scene)) return refuse(CHART_SCENE_LINE);

  const source = garmentSource(graph, boardId);
  if (!source.locked) return { ok: false, reason: source.reason, ruleId: source.ruleId };
  if (source.designProjectId === null) return refuse(NO_DESIGN_LINE);

  const design = await deps.design(source.designProjectId, source.version);
  if (design === null) return refuse(UNREADABLE_LINE);

  const settings = settingsFrom(board.settings, scene);
  const colourwayId = colourwayFor(design.spec, settings);
  const drawings = await drawGarment({
    spec: design.spec,
    charts: design.charts,
    images: design.images,
    roster: settings.roster,
    edge: settings.edge,
    ...(colourwayId === null ? {} : { colourwayId }),
  });
  if (drawings === null) return refuse(NO_DRAWING_LINE);

  const picture = await composeMockup({ scene, drawings, crop: settings.crop, edge: settings.edge });
  const file = await deps.store(picture.png);
  // The one shape this file can make: a picture the platform drew. `acceptAsset` and the database
  // are asked the same question again on the way in.
  const made = drawnAsset(file, "deterministic", "scene");
  if (!made.ok) return refuse(made.reason);

  await deps.record({ boardId: board.id, kind: board.kind, asset: made.asset, status: "ready", credits: null });
  await deps.setInputVersion(board, design.version);
  return {
    ok: true,
    fileId: file.fileId,
    width: picture.width,
    height: picture.height,
    notes: picture.notes,
    gaps: picture.gaps.map((gap) => gap.line),
  };
}
