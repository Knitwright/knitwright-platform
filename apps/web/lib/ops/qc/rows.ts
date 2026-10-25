import { z } from "zod";
import { CHECKLIST_KEYS, CHECKLIST_RESULTS, type ChecklistItem, type Measurement } from "./checklist";

export const inspectionRow = z.object({
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
    at: new Date(r.at).toISOString(),
  };
};

/** The inspection that decides: the newest one. Null when the order has none. */
export const latestInspection = (inspections: readonly Inspection[]): Inspection | null =>
  [...inspections].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : a.id < b.id ? 1 : -1))[0] ?? null;
