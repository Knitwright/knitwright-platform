import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { GoldenSampleState } from "./vocabulary";
import { GOLDEN_SAMPLE_STATES } from "./vocabulary";

/**
 * The golden sample tables (migration 20261110020000). Reads go through the client the caller passes, which in a
 * page is the member's own, so the database's own rules decide what is seen. Every write goes through the
 * server's client and one of the functions of that migration, each of which checks the person's role itself; the
 * brand and the person always come from the session.
 */

const NOT_FOUND = "That golden sample does not exist.";

export type Who = Readonly<{ brandId: string; userId: string }>;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const photoRow = z.object({ id: z.uuid(), file_id: z.uuid(), angle: z.string(), caption: z.string() });
const pomRow = z.object({
  id: z.uuid(),
  size_label: z.string(),
  letter: z.string(),
  code: z.string(),
  description: z.string(),
  measured_mm: z.number().int(),
  target_mm: z.number().int().nullable(),
  tol_minus_mm: z.number().int().nullable(),
  tol_plus_mm: z.number().int().nullable(),
  rule_id: z.string(),
});
const readingRow = z.object({
  id: z.uuid(),
  colour_name: z.string(),
  delta_e: z.coerce.number(),
  target_hex: z.string().nullable(),
  instrument: z.string().nullable(),
  white_point: z.string().nullable(),
  observer: z.string().nullable(),
  rule_id: z.string(),
});
const carryoverRow = z.object({ id: z.uuid(), to_version: z.number().int(), changed_fields: z.array(z.object({ field: z.string(), group: z.string() })) });

const goldenSampleRow = z.object({
  id: z.uuid(),
  product_id: z.uuid(),
  run_id: z.uuid(),
  design_version: z.number().int(),
  version: z.number().int(),
  state: z.enum(GOLDEN_SAMPLE_STATES),
  fit_rating: z.number().int().nullable(),
  colour_rating: z.number().int().nullable(),
  notes: z.string(),
  factory_profile_id: z.string(),
  approved_at: z.string().nullable(),
  closed_at: z.string().nullable(),
  created_at: z.string(),
  golden_sample_photos: z.array(photoRow),
  golden_sample_poms: z.array(pomRow),
  golden_sample_colour_readings: z.array(readingRow),
  golden_sample_carryovers: z.array(carryoverRow),
});

const SELECT = [
  "id, product_id, run_id, design_version, version, state, fit_rating, colour_rating, notes, factory_profile_id, approved_at, closed_at, created_at",
  "golden_sample_photos(id, file_id, angle, caption)",
  "golden_sample_poms(id, size_label, letter, code, description, measured_mm, target_mm, tol_minus_mm, tol_plus_mm, rule_id)",
  "golden_sample_colour_readings(id, colour_name, delta_e, target_hex, instrument, white_point, observer, rule_id)",
  "golden_sample_carryovers(id, to_version, changed_fields)",
].join(", ");

export interface PhotoView { readonly id: string; readonly fileId: string; readonly angle: string; readonly caption: string }
export interface PomView {
  readonly id: string;
  readonly sizeLabel: string;
  readonly letter: string;
  readonly code: string;
  readonly description: string;
  readonly measuredMm: number;
  readonly targetMm: number | null;
  readonly tolMinusMm: number | null;
  readonly tolPlusMm: number | null;
  readonly ruleId: string;
}
export interface ReadingView {
  readonly id: string;
  readonly colourName: string;
  readonly deltaE: number;
  readonly targetHex: string | null;
  readonly instrument: string | null;
  readonly whitePoint: string | null;
  readonly observer: string | null;
  readonly ruleId: string;
}
export interface GoldenSampleView {
  readonly id: string;
  readonly productId: string;
  readonly runId: string;
  readonly designVersion: number;
  readonly version: number;
  readonly state: GoldenSampleState;
  readonly fitRating: number | null;
  readonly colourRating: number | null;
  readonly notes: string;
  readonly factoryProfileId: string;
  readonly approvedAt: string | null;
  readonly closedAt: string | null;
  readonly createdAt: string;
  readonly photos: readonly PhotoView[];
  readonly poms: readonly PomView[];
  readonly readings: readonly ReadingView[];
  /** The later versions this sign-off was carried forward to, with why. */
  readonly carriedTo: readonly Readonly<{ toVersion: number; changed: readonly Readonly<{ field: string; group: string }>[] }>[];
}

const viewOf = (row: z.output<typeof goldenSampleRow>): GoldenSampleView => ({
  id: row.id,
  productId: row.product_id,
  runId: row.run_id,
  designVersion: row.design_version,
  version: row.version,
  state: row.state,
  fitRating: row.fit_rating,
  colourRating: row.colour_rating,
  notes: row.notes,
  factoryProfileId: row.factory_profile_id,
  approvedAt: row.approved_at,
  closedAt: row.closed_at,
  createdAt: row.created_at,
  photos: row.golden_sample_photos.map((p) => ({ id: p.id, fileId: p.file_id, angle: p.angle, caption: p.caption })),
  poms: row.golden_sample_poms.map((m) => ({
    id: m.id,
    sizeLabel: m.size_label,
    letter: m.letter,
    code: m.code,
    description: m.description,
    measuredMm: m.measured_mm,
    targetMm: m.target_mm,
    tolMinusMm: m.tol_minus_mm,
    tolPlusMm: m.tol_plus_mm,
    ruleId: m.rule_id,
  })),
  readings: row.golden_sample_colour_readings.map((c) => ({
    id: c.id,
    colourName: c.colour_name,
    deltaE: c.delta_e,
    targetHex: c.target_hex,
    instrument: c.instrument,
    whitePoint: c.white_point,
    observer: c.observer,
    ruleId: c.rule_id,
  })),
  carriedTo: row.golden_sample_carryovers.map((c) => ({ toVersion: c.to_version, changed: c.changed_fields })),
});

/** Every golden sample of a product with its evidence, newest attempt first. */
export async function listGoldenSamples(client: SupabaseClient, brandId: string, productId: string): Promise<readonly GoldenSampleView[]> {
  const { data, error } = await client
    .from("golden_samples")
    .select(SELECT)
    .eq("brand_id", brandId)
    .eq("product_id", productId)
    .order("version", { ascending: false })
    .limit(20);
  if (error) throw unreadable(error);
  const rows = z.array(goldenSampleRow).safeParse(data ?? []);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.map(viewOf);
}

/** The golden sample being judged now, or null when none is open. */
export const openGoldenSample = (samples: readonly GoldenSampleView[]): GoldenSampleView | null => samples.find((s) => s.state === "draft") ?? null;

export const startGoldenSample = async (admin: SupabaseClient, who: Who, input: Readonly<{ productId: string; runId: string }>): Promise<string> => {
  const { data, error } = await admin.rpc("start_golden_sample", { p_brand_id: who.brandId, p_user_id: who.userId, p_product_id: input.productId, p_run_id: input.runId });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const addPhoto = async (admin: SupabaseClient, who: Who, input: Readonly<{ goldenSampleId: string; fileId: string; angle: string; caption: string }>): Promise<string> => {
  const { data, error } = await admin.rpc("add_golden_sample_photo", {
    p_brand_id: who.brandId, p_user_id: who.userId, p_golden_sample_id: input.goldenSampleId, p_file_id: input.fileId, p_angle: input.angle, p_caption: input.caption,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export interface PomToAdd {
  readonly goldenSampleId: string;
  readonly sizeLabel: string;
  readonly letter: string;
  readonly code: string;
  readonly description: string;
  readonly measuredMm: number;
  readonly targetMm: number | null;
  readonly tolMinusMm: number | null;
  readonly tolPlusMm: number | null;
  readonly ruleId: string;
}

export const addPom = async (admin: SupabaseClient, who: Who, input: PomToAdd): Promise<string> => {
  const { data, error } = await admin.rpc("add_golden_sample_pom", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_golden_sample_id: input.goldenSampleId,
    p_size_label: input.sizeLabel,
    p_letter: input.letter,
    p_code: input.code,
    p_description: input.description,
    p_measured_mm: input.measuredMm,
    p_target_mm: input.targetMm,
    p_tol_minus_mm: input.tolMinusMm,
    p_tol_plus_mm: input.tolPlusMm,
    p_rule_id: input.ruleId,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export interface ReadingToAdd {
  readonly goldenSampleId: string;
  readonly colourName: string;
  readonly deltaE: number;
  readonly targetHex: string | null;
  readonly targetLab: readonly [number, number, number] | null;
  readonly measuredLab: readonly [number, number, number] | null;
  readonly instrument: string | null;
  readonly whitePoint: string | null;
  readonly observer: string | null;
  readonly ruleId: string;
}

export const addReading = async (admin: SupabaseClient, who: Who, input: ReadingToAdd): Promise<string> => {
  const { data, error } = await admin.rpc("add_golden_sample_colour_reading", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_golden_sample_id: input.goldenSampleId,
    p_colour_name: input.colourName,
    p_delta_e: input.deltaE,
    p_target_hex: input.targetHex,
    p_target_lab: input.targetLab,
    p_measured_lab: input.measuredLab,
    p_instrument: input.instrument,
    p_white_point: input.whitePoint,
    p_observer: input.observer,
    p_rule_id: input.ruleId,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

export const signOff = async (admin: SupabaseClient, who: Who, input: Readonly<{ goldenSampleId: string; fitRating: number; colourRating: number; notes: string }>): Promise<GoldenSampleState> => {
  const { data, error } = await admin.rpc("sign_off_golden_sample", {
    p_brand_id: who.brandId, p_user_id: who.userId, p_golden_sample_id: input.goldenSampleId, p_fit_rating: input.fitRating, p_colour_rating: input.colourRating, p_notes: input.notes,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.enum(GOLDEN_SAMPLE_STATES).parse(data);
};

export const requestChanges = async (admin: SupabaseClient, who: Who, input: Readonly<{ goldenSampleId: string; notes: string }>): Promise<GoldenSampleState> => {
  const { data, error } = await admin.rpc("request_golden_sample_changes", {
    p_brand_id: who.brandId, p_user_id: who.userId, p_golden_sample_id: input.goldenSampleId, p_notes: input.notes,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.enum(GOLDEN_SAMPLE_STATES).parse(data);
};

export const carryOver = async (
  admin: SupabaseClient,
  who: Who,
  input: Readonly<{ goldenSampleId: string; toVersion: number; changed: readonly Readonly<{ field: string; group: string }>[]; ruleId: string }>,
): Promise<string> => {
  const { data, error } = await admin.rpc("carry_over_golden_sample", {
    p_brand_id: who.brandId, p_user_id: who.userId, p_golden_sample_id: input.goldenSampleId, p_to_version: input.toVersion, p_changed_fields: input.changed, p_rule_id: input.ruleId,
  });
  if (error) throw refusal(error, NOT_FOUND);
  return z.uuid().parse(data);
};

const sentRow = z.object({
  run_id: z.uuid(),
  order_id: z.uuid(),
  status: z.string(),
  cutoff_at: z.string(),
  promised_on: z.string().nullable(),
  created: z.boolean(),
  golden_sample_id: z.uuid().nullable(),
});

export interface SentOrder {
  readonly runId: string;
  readonly orderId: string;
  readonly status: string;
  readonly cutoffAt: string;
  readonly promisedOn: string | null;
  /** False when the same request key had already been sent. */
  readonly created: boolean;
  /** The golden sample the run was allowed by, or null for a sample. */
  readonly goldenSampleId: string | null;
}

export interface OrderToSend {
  readonly productId: string;
  readonly kind: "sample" | "run";
  readonly releaseId: string;
  readonly factoryProfileId: string;
  readonly fabricKey: string;
  readonly sizes: Readonly<Record<string, number>>;
  readonly flags: readonly Readonly<{ code: string; text: string }>[];
  readonly requestKey: string;
}

/** Hands a sample or a run over through the make flow's door, which uses the brand run contract unchanged. */
export async function submitMakeOrder(admin: SupabaseClient, who: Who, order: OrderToSend): Promise<SentOrder> {
  const { data, error } = await admin.rpc("submit_make_order", {
    p_brand_id: who.brandId,
    p_user_id: who.userId,
    p_product_id: order.productId,
    p_kind: order.kind,
    p_release_id: order.releaseId,
    p_factory_profile_id: order.factoryProfileId,
    p_fabric_key: order.fabricKey,
    p_sizes: order.sizes,
    p_flags: order.flags,
    p_request_key: order.requestKey,
  });
  if (error) throw refusal(error, "That product does not exist.");
  const [row] = z.tuple([sentRow]).parse(data);
  return {
    runId: row.run_id,
    orderId: row.order_id,
    status: row.status,
    cutoffAt: row.cutoff_at,
    promisedOn: row.promised_on,
    created: row.created,
    goldenSampleId: row.golden_sample_id,
  };
}

type Failing = Readonly<{ code?: string; hint?: string | null; message: string }>;

/** A refusal the database made, in its own words where it wrote them for a person to read. */
export function refusal(error: Failing, missing: string): AppError {
  if (error.code === "42501") return new AppError("forbidden", error.message);
  if (error.code === "P0002") return new AppError("not_found", error.message || missing);
  if (error.code === "P0001" || error.code === "22023" || error.code === "23505" || error.code === "23514") {
    return new AppError("conflict", error.message);
  }
  return new AppError("internal", MESSAGES.internal, undefined, { cause: error });
}
