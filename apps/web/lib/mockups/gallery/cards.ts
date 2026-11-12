import { sourceViewOf } from "../views";
import type { ChartCard, MockupScene } from "../types";
import { inCategory, type MockupCategory } from "./categories";

/**
 * One card of the Mockups page (decision 0140): a scene, shown with the chosen product on it.
 *
 * The card's picture is the platform's own drawing of the design over the scene's own backdrop
 * colours, which are data on the scene's row. The finished picture is drawn by the same renderer
 * as a mockup board when the card is downloaded or opened on a canvas (`composeMockup`).
 */

export interface MockupCard {
  readonly slug: string;
  readonly title: string;
  /** "Free · from 3D", or what an AI scene costs. */
  readonly line: string;
  /** ♛: an AI scene, which spends credits on a canvas. */
  readonly premium: boolean;
  /** Which side of the design the scene shows first. */
  readonly view: "front" | "back";
  /** The scene's backdrop colours, `#rrggbb`, from its row. */
  readonly backdrop: Readonly<{ from: string; to: string | null }>;
  /** A chart card instead of a garment, or null. */
  readonly chart: ChartCard | null;
  /** Null when it can be downloaded here; otherwise why not. */
  readonly cannotDownload: string | null;
}

export const FREE_LINE = "Free · from 3D";
export const AI_LINE = "AI scene · uses credits";
export const AI_DOWNLOAD = "An AI scene is made on a launch canvas, where its cost is shown before it runs. Use Edit.";
export const CHART_DOWNLOAD = "A chart card is drawn from the design's own measurements on a launch canvas. Use Edit.";

/** The renderer's own sentence (`../garment.ts`), here too so the page can say it without loading the renderer. */
export const NO_DRAWING_LINE = "There is no drawing of this garment type yet, so a mockup cannot be built from it.";

/** The most scenes one download may hold. */
export const DOWNLOAD_LIMIT = 12;

const chartOf = (scene: MockupScene): ChartCard | null => scene.card ?? null;

const drawsChart = (scene: MockupScene): boolean => scene.card !== null || scene.slots.some((slot) => slot.presentation === "chart");

/** Whether this page can draw the scene as a file now. */
export const downloadable = (scene: MockupScene): boolean => scene.source === "deterministic" && !drawsChart(scene);

export function cardOf(scene: MockupScene): MockupCard {
  const ai = scene.source === "ai";
  return {
    slug: scene.slug,
    title: scene.title,
    line: ai ? AI_LINE : FREE_LINE,
    premium: ai,
    view: sourceViewOf(scene.slots[0]?.view ?? "front"),
    backdrop: { from: scene.backdrop.hex, to: scene.backdrop.hexTwo ?? null },
    chart: chartOf(scene),
    cannotDownload: ai ? AI_DOWNLOAD : drawsChart(scene) ? CHART_DOWNLOAD : null,
  };
}

/** The cards of one category, in the library's order. */
export const cardsFor = (scenes: readonly MockupScene[], category: MockupCategory): readonly MockupCard[] =>
  scenes.filter((scene) => inCategory(scene, category)).map(cardOf);

/** The address that downloads these scenes of this design: one picture, or a zip of several. */
export function downloadHref(designId: string, colourwayId: string | null, slugs: readonly string[]): string {
  const query = new URLSearchParams({ design: designId });
  if (colourwayId !== null) query.set("colourway", colourwayId);
  for (const slug of slugs.slice(0, DOWNLOAD_LIMIT)) query.append("scene", slug);
  return `/api/mockups/download?${query.toString()}`;
}

type SearchValue = string | string[] | undefined;
const first = (value: SearchValue): string | null => (Array.isArray(value) ? value[0] : value) ?? null;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COLOURWAY = /^[A-Za-z0-9_-]{1,64}$/;

/** The design an address names, when it looks like one. Whether it is the brand's is the database's question. */
export function designFromQuery(value: SearchValue): string | null {
  const raw = first(value);
  return raw !== null && UUID.test(raw) ? raw : null;
}

export function colourwayFromQuery(value: SearchValue): string | null {
  const raw = first(value);
  return raw !== null && COLOURWAY.test(raw) ? raw : null;
}

/** The page's own address with one setting changed, keeping the others. */
export function mockupsHref(state: Readonly<{ design: string | null; colourway: string | null; category: MockupCategory }>): string {
  const query = new URLSearchParams();
  if (state.design !== null) query.set("design", state.design);
  if (state.colourway !== null) query.set("colourway", state.colourway);
  if (state.category !== "all") query.set("cat", state.category);
  const text = query.toString();
  return text ? `/mockups?${text}` : "/mockups";
}
