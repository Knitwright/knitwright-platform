import { z } from "zod";
import { freeText, kebabId, localId } from "./primitives";
import { provenanceSchema } from "./provenance";

/**
 * What the Specs toolbar draws, as part of the design (spec F-S6, plan v5 Y4).
 *
 * The toolbar's five tools make two kinds of mark, and a design keeps each in its own list:
 *
 * - **An extra point of measure**: the founder's own QC point, "measured on the sample, not
 *   graded". It is never one of the base article's graded points — those have a `pointId` the
 *   garment registry knows and live in `measurements` — so it carries its own name instead, and no
 *   grade and no tolerance (plan v5 decision 18).
 * - **A callout**: a place on a panel and a note for the factory, which the tech pack numbers on
 *   from the base article's own construction rows.
 *
 * Both are kept here rather than in a panel's own memory, because a mark a person draws is their
 * work: it shows on the tech pack, goes into every export, and must still be there after a reload
 * (review of plan v5, item D-5). `lib/techpack/view/marks.ts` reads these back as the marks the
 * toolbar drew, so one mark is drawn, stored and shown from one shape.
 */

/** The tools whose marks are a point of measure. A callout is a note, so it is not one of them. */
export const MEASURE_TOOLS = ["measure-point", "measure-line", "measure-edge"] as const;
export type MeasureTool = (typeof MEASURE_TOOLS)[number];

/** Which view the mark was drawn on, so the tech pack can say where it came from. */
export const DRAWN_ON = ["2d", "3d"] as const;

export const MARK_LABEL_MAX_LENGTH = 60;
export const MARK_NOTE_MAX_LENGTH = 200;

/**
 * How far from a panel's own origin a picked place may sit: ten metres either way. Far past any
 * garment panel, so it refuses a number that is a typo and nothing a person could really draw.
 */
const MARK_MAX_MM = 10_000;
/** The longest a measured line may be, in whole millimetres. */
const MARK_MAX_LENGTH_MM = 100_000;
/** The most places one mark may be picked at, so a polyline cannot grow without bound. */
const MARK_MAX_POINTS = 32;

/** The most marks of each kind one design may hold. More than any tech pack has ever needed. */
export const MAX_EXTRA_POMS = 32;
export const MAX_CALLOUTS = 32;

const millimetres = z.number().finite().min(-MARK_MAX_MM).max(MARK_MAX_MM);

/** One place picked on a panel, in millimetres from the panel's own origin. */
const markPointSchema = z.strictObject({ panelId: kebabId, xMm: millimetres, yMm: millimetres }).readonly();
export type MarkPoint = z.output<typeof markPointSchema>;

/** What every mark holds: who it is, what it is called, the note, and where it was drawn. */
const markShape = {
  id: localId,
  /** What the person called it. Never empty: the panel's own name stands in (`makeMark`). */
  label: freeText(MARK_LABEL_MAX_LENGTH).min(1, "Give the mark a name."),
  /** The note for the factory, or null when none was written. */
  note: freeText(MARK_NOTE_MAX_LENGTH).nullable(),
  points: z.array(markPointSchema).min(1, "Pick at least one place.").max(MARK_MAX_POINTS).readonly(),
  drawnOn: z.enum(DRAWN_ON),
  provenance: provenanceSchema,
};

/**
 * A founder's own point of measure. `lengthMm` is measured, never typed: it is the length of the
 * picked line or of the picked edge in whole millimetres. It is null, never a nought, for a mark
 * that has no length at all — a measure point, and an edge whose length the drawing did not give.
 */
export const designPomSchema = z
  .strictObject({
    ...markShape,
    tool: z.enum(MEASURE_TOOLS),
    lengthMm: z.number().int().min(0).max(MARK_MAX_LENGTH_MM).nullable(),
  })
  .readonly();
export type DesignPom = z.output<typeof designPomSchema>;

/** A callout: one place on a panel and the note that goes with it on the tech pack. */
export const designCalloutSchema = z.strictObject(markShape).readonly();
export type DesignCallout = z.output<typeof designCalloutSchema>;

/** Every id that appears more than once in a list of marks, which no design may hold. */
export function repeatedMarkIds(marks: readonly Readonly<{ id: string }>[]): readonly string[] {
  const seen = new Set<string>();
  const again: string[] = [];
  for (const mark of marks) {
    if (seen.has(mark.id)) again.push(mark.id);
    seen.add(mark.id);
  }
  return again;
}
