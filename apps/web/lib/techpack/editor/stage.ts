import type { BaseArticle } from "@/lib/catalogue";
import type { PomRow } from "../view/measurements";
import type { PickedPoint, SpecMark } from "../view/marks";

/**
 * Where the red measurement points (A, B, C ...) and the blue numbered callouts sit on the garment
 * in the tech pack editor's stage (spec screen 30; `10` §2 tech pack marks).
 *
 * A place on the stage is a place to look, never a measurement: every number the factory reads is
 * in the tables, from the base article. A point is placed by its article code (`CH`, `BL` ...),
 * then by a word in its description; a point neither names is listed under the stage as not drawn,
 * rather than put somewhere it is not. A callout the founder put on the stage keeps the place they
 * picked, stored with the panel id `stage` (decision 0151).
 */

/** The stage drawing's own coordinates: a front view in a 400 × 480 box. */
export const STAGE_BOX = { width: 400, height: 480 } as const;

/** The panel id a callout picked on the stage is stored under. */
export const STAGE_PANEL = "stage";

export type StageXY = Readonly<{ x: number; y: number }>;
/** A red measurement line from one end to the other. */
export type StageLine = Readonly<{ from: StageXY; to: StageXY }>;

type Place = Readonly<{ at: StageXY; line: StageLine | null }>;

const at = (x: number, y: number): StageXY => ({ x, y });
const across = (y: number, from: number, to: number): StageLine => ({ from: at(from, y), to: at(to, y) });
const down = (x: number, from: number, to: number): StageLine => ({ from: at(x, from), to: at(x, to) });

/** The article codes of `JSY-SS-01`'s points of measure and where each is looked for. */
const BY_CODE: Readonly<Record<string, Place>> = {
  CH: { at: at(282, 214), line: across(214, 118, 282) },
  BL: { at: at(150, 300), line: down(150, 92, 420) },
  SW: { at: at(286, 112), line: across(112, 114, 286) },
  SL: { at: at(336, 160), line: null },
  BI: { at: at(76, 168), line: null },
  SO: { at: at(56, 206), line: null },
  AD: { at: at(250, 150), line: null },
  NW: { at: at(168, 86), line: null },
  FND: { at: at(200, 120), line: null },
  BND: { at: at(226, 92), line: null },
  HW: { at: at(200, 420), line: across(420, 118, 282) },
  NR: { at: at(232, 104), line: null },
};

/** A word of the description and the code whose place it takes, for an article with other codes. */
const BY_WORD: readonly (readonly [RegExp, string])[] = [
  [/chest/i, "CH"],
  [/body length/i, "BL"],
  [/shoulder width|across shoulder/i, "SW"],
  [/sleeve length/i, "SL"],
  [/bicep/i, "BI"],
  [/sleeve opening/i, "SO"],
  [/armhole/i, "AD"],
  [/back neck/i, "BND"],
  [/neck drop/i, "FND"],
  [/neck rib/i, "NR"],
  [/neck width/i, "NW"],
  [/hem width/i, "HW"],
];

export type StagePoint = Readonly<{ letter: string; description: string; at: StageXY; line: StageLine | null }>;
export type StagePoints = Readonly<{ drawn: readonly StagePoint[]; notDrawn: readonly string[] }>;

function placeOf(code: string, description: string): Place | null {
  const own = BY_CODE[code.toUpperCase()];
  if (own) return own;
  const word = BY_WORD.find(([pattern]) => pattern.test(description));
  return word ? (BY_CODE[word[1]] ?? null) : null;
}

/** The measurement points of the table, placed. Each table row is drawn at most once. */
export function stagePoints(rows: readonly Pick<PomRow, "letter" | "code" | "description">[]): StagePoints {
  const drawn: StagePoint[] = [];
  const notDrawn: string[] = [];
  for (const row of rows) {
    const place = placeOf(row.code, row.description);
    if (place) drawn.push({ letter: row.letter, description: row.description, ...place });
    else notDrawn.push(row.letter);
  }
  return { drawn, notDrawn };
}

/** Where a construction step of the article is looked for, by the words of its seam. First match wins. */
const SEAM_PLACES: readonly (readonly [RegExp, StageXY])[] = [
  [/sleeve hem/i, at(346, 196)],
  [/body hem|^hem/i, at(244, 424)],
  [/back neck/i, at(176, 96)],
  [/neck label/i, at(214, 128)],
  [/care label/i, at(122, 392)],
  [/neck/i, at(200, 78)],
  [/shoulder/i, at(254, 98)],
  [/sleeve/i, at(302, 136)],
  [/side|underarm/i, at(284, 300)],
];

export type StageCallout = Readonly<{
  number: number;
  text: string;
  at: StageXY | null;
  /** The drawn mark's id, for a callout the founder added; null for the base article's own. */
  markId: string | null;
}>;

const seamPlace = (seam: string): StageXY | null => SEAM_PLACES.find(([pattern]) => pattern.test(seam))?.[1] ?? null;

const stagePick = (points: readonly PickedPoint[]): StageXY | null => {
  const first = points.find((point) => point.panelId === STAGE_PANEL);
  return first ? at(first.xMm, first.yMm) : null;
};

/**
 * The numbered callouts, in the same order and with the same numbers as the Callouts tab
 * (`buildCallouts`): the base article's construction steps, then the founder's own.
 */
export function stageCallouts(article: Pick<BaseArticle, "construction"> | null, marks: readonly SpecMark[]): readonly StageCallout[] {
  const steps = article?.construction ?? [];
  const drawn = marks.filter((mark) => mark.tool === "callout");
  return [
    ...steps.map((step) => ({ number: step.step, text: `${step.seam}: ${step.operation}`, at: seamPlace(step.seam), markId: null })),
    ...drawn.map((mark, index) => ({
      number: steps.length + index + 1,
      text: mark.note === null ? mark.label : `${mark.label}: ${mark.note}`,
      at: stagePick(mark.points) ?? seamPlace(mark.label),
      markId: mark.id,
    })),
  ];
}

/** A place clicked on the stage, from where it fell in the drawn box, kept inside the box. */
export function stagePointFrom(fractionX: number, fractionY: number): PickedPoint {
  const clamp = (value: number) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));
  return {
    panelId: STAGE_PANEL,
    xMm: Math.round(clamp(fractionX) * STAGE_BOX.width),
    yMm: Math.round(clamp(fractionY) * STAGE_BOX.height),
  };
}
