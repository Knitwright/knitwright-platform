import { z } from "zod";

/** A point on a pattern piece, in millimetres, as [x, y]. */
export const pointSchema = z.tuple([z.number().finite(), z.number().finite()]);
export type Point = z.output<typeof pointSchema>;

/** Three or more points. The first point is not repeated at the end. */
const closedPolylineSchema = z.array(pointSchema).min(3).max(5000);
const openPolylineSchema = z.array(pointSchema).min(2).max(5000);

const lineSchema = z.object({ from: pointSchema, to: pointSchema });
export type PieceLine = z.output<typeof lineSchema>;

/**
 * Named places on a piece that measurements and print zones are taken from. A new name is an
 * additive change to this list, made in a small PR labelled `contract`.
 * On a sleeve, "a" is the end with the lower y; the DXF does not say which end is the front.
 */
export const LANDMARK_IDS = [
  "hps",
  "shoulder-point",
  "underarm",
  "cf-neck",
  "cf-hem",
  "cb-neck",
  "cb-hem",
  "side-hem",
  "cap-top",
  "underarm-a",
  "underarm-b",
  "hem-a",
  "hem-b",
] as const;

export const landmarkIdSchema = z.enum(LANDMARK_IDS);
export type LandmarkId = z.output<typeof landmarkIdSchema>;

/** A seam is named once and both of its pieces use the same id, for example "side-seam". */
const seamIdSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64);

export const notchSchema = z.object({
  seamId: seamIdSchema,
  at: pointSchema,
  /** One notch for the front, two for the back, as the cutter reads them. */
  count: z.number().int().min(1).max(3),
});
export type Notch = z.output<typeof notchSchema>;

export const SEAM_ALLOWANCE_SOURCES = ["pattern-file", "knitwright-default", "not-stated"] as const;

/** Extra fabric at one seam. `mm` is null exactly when the source is "not-stated". */
export const seamAllowanceSchema = z
  .object({
    seamId: seamIdSchema,
    mm: z.number().finite().min(0).max(100).nullable(),
    source: z.enum(SEAM_ALLOWANCE_SOURCES),
  })
  .refine((a) => (a.source === "not-stated") === (a.mm === null), {
    message: "A seam allowance has a size exactly when its source says one.",
  });
export type SeamAllowance = z.output<typeof seamAllowanceSchema>;

/** Whether the cut outline already holds the seam allowance. A file that does not say is "unknown". */
export const OUTLINE_KINDS = ["with-seam-allowance", "without-seam-allowance", "unknown"] as const;

export const patternPieceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/).max(64),
    name: z.string().min(1).max(120),
    sizeLabel: z.string().min(1).max(16),
    /** Pieces cut in all, counting both halves of a mirrored pair. A piece cut on the fold counts once. */
    quantity: z.number().int().min(1).max(20),
    /** Cut as a left and a right. */
    mirroredPair: z.boolean(),
    onFold: z.boolean(),
    outlineKind: z.enum(OUTLINE_KINDS),
    cutOutline: closedPolylineSchema,
    sewLine: closedPolylineSchema.nullable(),
    notches: z.array(notchSchema).max(200),
    seamAllowance: z.array(seamAllowanceSchema).max(200),
    grainLine: lineSchema.nullable(),
    foldLine: lineSchema.nullable(),
    internalLines: z.array(openPolylineSchema).max(100),
    landmarks: z.partialRecord(landmarkIdSchema, pointSchema),
  })
  .refine((p) => !p.onFold || p.foldLine !== null, { message: "A piece cut on the fold needs its fold line." })
  .refine((p) => !p.mirroredPair || p.quantity % 2 === 0, { message: "A mirrored pair is cut in twos." });
export type PatternPiece = z.output<typeof patternPieceSchema>;

/** A pattern block, version and the pieces of every size in it. */
export const gradedPatternSchema = z
  .object({
    blockId: z.string().min(1).max(120),
    blockVersion: z.number().int().min(1),
    sizes: z.array(z.string().min(1).max(16)).min(1).max(30),
    piecesBySize: z.record(z.string(), z.array(patternPieceSchema).min(1).max(200)),
  })
  .refine(
    (g) => g.sizes.length === Object.keys(g.piecesBySize).length && g.sizes.every((s) => Object.hasOwn(g.piecesBySize, s)),
    { message: "Every size has pieces, and no other size has." },
  )
  .refine(
    (g) => g.sizes.every((s) => (Object.hasOwn(g.piecesBySize, s) ? g.piecesBySize[s] : []).every((p) => p.sizeLabel === s)),
    { message: "Every piece carries the size it is listed under." },
  );
export type GradedPattern = z.output<typeof gradedPatternSchema>;

/** A point of measure read from a pattern. Stored in tenths of a millimetre like every measurement. */
export const patternMeasurementSchema = z.object({
  pointId: z.string().min(1).max(64),
  size: z.string().min(1).max(16),
  tenthsMm: z.number().int().min(0).max(100_000),
  source: z.literal("measured-from-pattern"),
  /** How it was measured, in one sentence a technician can follow. */
  method: z.string().min(1).max(300),
});
export type PatternMeasurement = z.output<typeof patternMeasurementSchema>;
