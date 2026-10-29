import { z } from "zod";
import type { FilesServiceOperation } from "./operations";

/**
 * The typed request and answer of every files-service operation (decision 0070). Answers are
 * parsed with zod, because the service is another process: a shape the platform does not
 * recognise is a failure, never a value that reaches a factory file.
 *
 * Every length is millimetres and every mass is grams, as everywhere else in the platform.
 * Money is integer minor units with a currency (plan v5, owner decision 4).
 */

const mm = z.number().finite().min(0).max(100_000);
const point = z.tuple([z.number().finite(), z.number().finite()]);
const key = z.string().min(1).max(512);

/** An object in our own storage, by key. No file bytes cross this seam: the service reads and writes R2. */
export const fileRefSchema = z.object({ key, bytes: z.number().int().min(0), contentType: z.string().min(1).max(128) });
export type FileRef = z.output<typeof fileRefSchema>;

export const ruleIdSchema = z.string().regex(/^R-[A-Z]+-[0-9]{3}$/);

/** A finding the service reports. It carries a rule id like every other finding in the platform. */
export const serviceFindingSchema = z.object({
  code: z.string().min(1).max(64),
  severity: z.enum(["info", "warning", "blocker"]),
  message: z.string().min(1).max(500),
  ruleId: ruleIdSchema,
});
export type ServiceFinding = z.output<typeof serviceFindingSchema>;

// ── draft_pattern ────────────────────────────────────────────────────────────────────────────

export type DraftPatternRequest = Readonly<{
  articleCode: string;
  size: string;
  /** Body measurements in millimetres, by the article's own measurement codes. */
  bodyMm: Readonly<Record<string, number>>;
  parameters: Readonly<Record<string, number | string | boolean>>;
}>;

export const draftPatternAnswerSchema = z.object({
  pieces: z.array(z.object({ id: z.string().min(1).max(64), name: z.string().min(1).max(120), cutOutline: z.array(point).min(3) })).min(1),
  findings: z.array(serviceFindingSchema),
});
export type DraftPatternAnswer = z.output<typeof draftPatternAnswerSchema>;

// ── read_dxf ─────────────────────────────────────────────────────────────────────────────────

export type ReadDxfRequest = Readonly<{ file: FileRef; expectUnits: "mm" | "inch" }>;

export const readDxfAnswerSchema = z.object({
  pieces: z.array(z.object({ name: z.string().min(1).max(120), cutOutline: z.array(point).min(3), closed: z.boolean() })),
  unitsRead: z.enum(["mm", "inch", "unknown"]),
  findings: z.array(serviceFindingSchema),
});
export type ReadDxfAnswer = z.output<typeof readDxfAnswerSchema>;

// ── nest_marker ──────────────────────────────────────────────────────────────────────────────

/**
 * A grain-constrained nest. `napOneWay` forbids turning a piece through 180 degrees, which a
 * napped or directional print needs. `shrinkagePercent` is applied before nesting, so the marker
 * is cut to the fabric's relaxed size.
 */
export type NestMarkerRequest = Readonly<{
  /** Pieces by name with how many of each the marker holds, per size. */
  piecesBySize: Readonly<Record<string, Readonly<Record<string, number>>>>;
  fabricWidthMm: number;
  shrinkagePercent: Readonly<{ warp: number; weft: number }>;
  napOneWay: boolean;
  /** Grams per square metre, for the per-kilogram price. */
  fabricGsm: number;
  price: Readonly<{ perMetreMinor: number | null; perKilogramMinor: number | null; currency: string }>;
}>;

export const nestMarkerAnswerSchema = z.object({
  markerLengthMm: mm,
  markerWidthMm: mm,
  /** The share of the marker rectangle the pieces cover, 0 to 1. */
  utilisation: z.number().min(0).max(1),
  fabricGrams: z.number().finite().min(0),
  /** Null when the factory profile gave no price for this fabric. */
  costMinor: z.number().int().min(0).nullable(),
  currency: z.string().length(3),
  marker: fileRefSchema.nullable(),
  findings: z.array(serviceFindingSchema),
});
export type NestMarkerAnswer = z.output<typeof nestMarkerAnswerSchema>;

// ── fit_check ────────────────────────────────────────────────────────────────────────────────

export type FitCheckRequest = Readonly<{
  articleCode: string;
  size: string;
  avatarId: string;
  parameters: Readonly<Record<string, number | string | boolean>>;
}>;

export const fitCheckAnswerSchema = z.object({
  /** Ease at each named place, in millimetres; negative is tight. */
  easeMm: z.record(z.string(), z.number().finite()),
  findings: z.array(serviceFindingSchema),
});
export type FitCheckAnswer = z.output<typeof fitCheckAnswerSchema>;

// ── render_garment ───────────────────────────────────────────────────────────────────────────

export const RENDER_VIEWS = ["front", "back", "left", "right"] as const;
export const RENDER_SCENES = ["ghost_mannequin", "on_model"] as const;

/**
 * A render of the garment. The geometry is locked: the service renders the panels and their
 * layers, it does not draw a garment. Spec decision 13: AI never draws the garment, so a
 * generated pixel never reaches a panel layer or a print file.
 */
export type RenderGarmentRequest = Readonly<{
  designVersionHash: string;
  articleCode: string;
  size: string;
  views: readonly (typeof RENDER_VIEWS)[number][];
  scene: (typeof RENDER_SCENES)[number];
  /** A model preset the viewer consented to, for `on_model`; null for a ghost mannequin. */
  modelPresetId: string | null;
  widthPx: number;
}>;

export const renderGarmentAnswerSchema = z.object({
  images: z.array(z.object({ view: z.enum(RENDER_VIEWS), file: fileRefSchema })),
  /** The label every render carries in the package (docs/spec/04, 10_reference). */
  label: z.literal("render, not photo"),
  findings: z.array(serviceFindingSchema),
});
export type RenderGarmentAnswer = z.output<typeof renderGarmentAnswerSchema>;

// ── transfer_design and composite_logo ───────────────────────────────────────────────────────

export type TransferDesignRequest = Readonly<{
  /** The render the design goes onto. Never a panel layer and never a print file. */
  render: FileRef;
  design: FileRef | null;
  fabricTexture: FileRef | null;
  designVersionHash: string;
}>;

export type CompositeLogoRequest = Readonly<{
  render: FileRef;
  logo: FileRef;
  /** Where the logo sits on the render, in millimetres from the panel's anchor. */
  placementMm: Readonly<{ x: number; y: number; widthMm: number }>;
  designVersionHash: string;
}>;

export const compositeAnswerSchema = z.object({
  image: fileRefSchema,
  /** Nothing here may be applied to a panel; the service says so with every answer. */
  appliesToPanels: z.literal(false),
  findings: z.array(serviceFindingSchema),
});
export type CompositeAnswer = z.output<typeof compositeAnswerSchema>;

// ── detect_brand_marks ───────────────────────────────────────────────────────────────────────

export type DetectBrandMarksRequest = Readonly<{ image: FileRef; text: readonly string[] }>;

export const detectBrandMarksAnswerSchema = z.object({
  result: z.enum(["clear", "flagged"]),
  reasons: z.array(z.string().min(1).max(300)),
  findings: z.array(serviceFindingSchema),
});
export type DetectBrandMarksAnswer = z.output<typeof detectBrandMarksAnswerSchema>;

// ── health ───────────────────────────────────────────────────────────────────────────────────

export const healthAnswerSchema = z.object({
  service: z.literal("knitwright-files"),
  version: z.string().min(1).max(64),
  operations: z.array(z.string().min(1).max(64)),
});
export type HealthAnswer = z.output<typeof healthAnswerSchema>;

// ── the seam ─────────────────────────────────────────────────────────────────────────────────

/** Request and answer by operation, so one typed `call` serves them all. */
export interface FilesServiceShapes {
  draft_pattern: { request: DraftPatternRequest; answer: DraftPatternAnswer };
  read_dxf: { request: ReadDxfRequest; answer: ReadDxfAnswer };
  nest_marker: { request: NestMarkerRequest; answer: NestMarkerAnswer };
  fit_check: { request: FitCheckRequest; answer: FitCheckAnswer };
  render_garment: { request: RenderGarmentRequest; answer: RenderGarmentAnswer };
  transfer_design: { request: TransferDesignRequest; answer: CompositeAnswer };
  composite_logo: { request: CompositeLogoRequest; answer: CompositeAnswer };
  detect_brand_marks: { request: DetectBrandMarksRequest; answer: DetectBrandMarksAnswer };
}

export const ANSWER_SCHEMAS: Readonly<{ [K in FilesServiceOperation]: z.ZodType<FilesServiceShapes[K]["answer"]> }> = {
  draft_pattern: draftPatternAnswerSchema,
  read_dxf: readDxfAnswerSchema,
  nest_marker: nestMarkerAnswerSchema,
  fit_check: fitCheckAnswerSchema,
  render_garment: renderGarmentAnswerSchema,
  transfer_design: compositeAnswerSchema,
  composite_logo: compositeAnswerSchema,
  detect_brand_marks: detectBrandMarksAnswerSchema,
};

/** Why a call did not give an answer. `not_available` is the only one the stub ever gives. */
export const FAILURES = ["not_available", "refused", "unreachable", "bad_answer", "timed_out", "service_error"] as const;
export type FailureKind = (typeof FAILURES)[number];

export type Failure = Readonly<{ ok: false; failure: FailureKind; message: string }>;

export type Answered<T> = Readonly<{ ok: true; answer: T }> | Failure;

/**
 * The seam. One method, so a new operation is a type change and not a new interface, and so the
 * stub and the real client cannot drift apart.
 */
export interface FilesService {
  /** Names the implementation in logs. Never shown to a member. */
  readonly name: string;
  health(): Promise<Answered<HealthAnswer>>;
  call<K extends FilesServiceOperation>(
    operation: K,
    request: FilesServiceShapes[K]["request"],
    signal?: AbortSignal,
  ): Promise<Answered<FilesServiceShapes[K]["answer"]>>;
}
