/**
 * TEST SUPPORT ONLY. Inputs for the tech pack view's tests.
 *
 * The base article is the seeded `JSY-SS-01`, so the tests read the rows the app really reads
 * (lesson: never invent a label or a value a test can get from the catalogue). The design is the
 * tech pack's own `fullDesign` fixture, whose numbers are made up and are never loaded as real data.
 */
import { jersey, seeded } from "@/lib/editor/fixtures/article";
import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { fullDesign } from "../../fixtures/designs";
import type { SpecMark } from "../marks";
import type { TechPackViewInput } from "../model";
import type { OverviewHeader } from "../overview";

export const TYPE_ID = "team-jersey";

export const article = (): BaseArticle => jersey();
/** A launch article seeded as a draft: a code and a size range, and no points of measure. */
export const bareArticle = (): BaseArticle => seeded("SHO-TR-01");

export const design = (): GarmentSpec => fullDesign(TYPE_ID);
export const emptyDesign = (): GarmentSpec => start(TYPE_ID);

export const header = (patch: Partial<OverviewHeader> = {}): OverviewHeader => ({
  styleName: "Rovers home shirt",
  formName: "Crew neck · Coverstitch hem",
  brand: "Rovers FC",
  collection: "League 2026",
  season: "Spring/Summer 2026",
  factory: "Sialkot Sports Ltd",
  ...patch,
});

export const emptyHeader = (): OverviewHeader => ({
  styleName: null,
  formName: null,
  brand: null,
  collection: null,
  season: null,
  factory: null,
});

export const mark = (patch: Partial<SpecMark> = {}): SpecMark => ({
  id: "m1",
  tool: "measure-line",
  label: "Pocket opening",
  note: null,
  points: [
    { panelId: "front", xMm: 0, yMm: 0 },
    { panelId: "front", xMm: 120, yMm: 0 },
  ],
  lengthMm: 120,
  drawnOn: "2d",
  ...patch,
});

export function input(patch: Partial<TechPackViewInput> = {}): TechPackViewInput {
  const base = article();
  return {
    spec: design(),
    article: base,
    header: header(),
    size: base.sampleSize ?? "M",
    sizes: base.sizeRange,
    colourwayId: design().colourways[0].id,
    marks: [],
    extras: [],
    unit: "mm",
    mode: "measurement",
    ...patch,
  };
}
