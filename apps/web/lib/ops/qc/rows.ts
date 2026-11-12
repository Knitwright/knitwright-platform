import { z } from "zod";
import { CHECKLIST_KEYS, CHECKLIST_RESULTS, type ChecklistItem, type Measurement } from "./checklist";
import type { ColourReading } from "./colour";

const inspectionRow = z.object({
  id: z.uuid(),
  order_id: z.uuid(),
  factory_profile_id: z.string(),
  result: z.enum(["pass", "fail"]),
  checklist: z.array(z.object({ key: z.enum(CHECKLIST_KEYS), result: z.enum(CHECKLIST_RESULTS), note: z.string().optional() })),
  measurements: z.array(z.object({ point: z.string(), specMm: z.number(), measuredMm: z.number(), toleranceMm: z.number() })),
  sample_size: z.number().int(),
  defect_count: z.number().int(),
  photo_file_ids: z.array(z.string()),
  note: z.string(),
  exception_id: z.uuid().nullable(),
  aql_code_letter: z.string().nullable().default(null),
  photos_shared: z.boolean().default(false),
  at: z.string(),
});

export interface Inspection {
  readonly id: string;
  readonly orderId: string;
  readonly factoryProfileId: string;
  readonly result: "pass" | "fail";
  readonly checklist: readonly ChecklistItem[];
  readonly measurements: readonly Measurement[];
  readonly sampleSize: number;
  readonly defectCount: number;
  readonly photoFileIds: readonly string[];
  readonly note: string;
  readonly exceptionId: string | null;
  /** The sample size code letter the plan gave, or null when no sampling plan was on file. */
  readonly aqlCodeLetter: string | null;
  /** Whether the customer sees this inspection's photos on their order page (decision 0143). */
  readonly photosShared: boolean;
  /** ISO time. */
  readonly at: string;
}

export const toInspection = (data: unknown): Inspection => {
  const r = inspectionRow.parse(data);
  return {
    id: r.id,
    orderId: r.order_id,
    factoryProfileId: r.factory_profile_id,
    result: r.result,
    checklist: r.checklist.map((c) => ({ key: c.key, result: c.result, note: c.note ?? "" })),
    measurements: r.measurements,
    sampleSize: r.sample_size,
    defectCount: r.defect_count,
    photoFileIds: r.photo_file_ids,
    note: r.note,
    exceptionId: r.exception_id,
    aqlCodeLetter: r.aql_code_letter,
    photosShared: r.photos_shared,
    at: new Date(r.at).toISOString(),
  };
};

const colourReadingRow = z.object({
  id: z.uuid(),
  inspection_id: z.uuid(),
  colour_name: z.string(),
  delta_e: z.coerce.number(),
  limit_delta_e: z.coerce.number().nullable(),
  method: z.string().nullable(),
  instrument: z.string().nullable(),
  white_point: z.string().nullable(),
  observer: z.string().nullable(),
  rule_id: z.string(),
  at: z.string(),
});

/** A reading as the database kept it, with what it was judged against at the time. */
export interface RecordedColourReading extends ColourReading {
  readonly id: string;
  readonly inspectionId: string;
  readonly at: string;
}

export const toColourReading = (data: unknown): RecordedColourReading => {
  const r = colourReadingRow.parse(data);
  return {
    id: r.id,
    inspectionId: r.inspection_id,
    colourName: r.colour_name,
    deltaE: r.delta_e,
    limitDeltaE: r.limit_delta_e,
    method: r.method,
    instrument: r.instrument,
    whitePoint: r.white_point,
    observer: r.observer,
    ruleId: r.rule_id,
    at: new Date(r.at).toISOString(),
  };
};

/** The inspection that decides: the newest one. Null when the order has none. */
export const latestInspection = (inspections: readonly Inspection[]): Inspection | null =>
  [...inspections].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1))[0] ?? null;
