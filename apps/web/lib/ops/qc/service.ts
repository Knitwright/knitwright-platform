import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistItem, Measurement } from "./checklist";
import type { ColourReading } from "./colour";
import { throwIfQcFailed } from "./errors";
import { toColourReading, toInspection, type Inspection, type RecordedColourReading } from "./rows";

type Admin = Pick<SupabaseClient, "rpc">;

const COLUMNS = "id, order_id, factory_profile_id, result, checklist, measurements, sample_size, defect_count, photo_file_ids, note, exception_id, aql_code_letter, at";

const READING_COLUMNS = "id, inspection_id, colour_name, delta_e, limit_delta_e, method, instrument, white_point, observer, rule_id, at";

/** Every inspection of an order, newest first. Read with the person's own client: row level security lets platform admins read. */
export async function listInspections(client: SupabaseClient, orderId: string): Promise<readonly Inspection[]> {
  const { data, error } = await client.from("ops_qc_inspections").select(COLUMNS).eq("order_id", orderId).order("at", { ascending: false }).order("id", { ascending: false }).limit(200);
  throwIfQcFailed(error);
  return (data ?? []).map(toInspection);
}

/** Every colour reading of an order's inspections, newest inspection first. */
export async function listColourReadings(client: SupabaseClient, orderId: string): Promise<readonly RecordedColourReading[]> {
  const { data, error } = await client.from("ops_qc_colour_readings").select(READING_COLUMNS).eq("order_id", orderId).order("at", { ascending: false }).order("colour_name").limit(500);
  throwIfQcFailed(error);
  return (data ?? []).map(toColourReading);
}

export interface InspectionToRecord {
  readonly orderId: string;
  readonly checklist: readonly ChecklistItem[];
  readonly measurements: readonly Measurement[];
  readonly colourReadings: readonly ColourReading[];
  /** The sample size code letter the plan gave, or null when no plan is on file. */
  readonly aqlCodeLetter: string | null;
  readonly sampleSize: number;
  readonly defectCount: number;
  readonly photoFileIds: readonly string[];
  readonly note: string;
  /** Needed when the result is a fail: the pieces to make again, who owns it, and by when. */
  readonly remake: Readonly<{ sizes: Readonly<Record<string, number>>; owner: string; dueOn: string }> | null;
}

interface RecordedInspection {
  readonly inspectionId: string;
  readonly result: "pass" | "fail";
  readonly exceptionId: string | null;
}

/** Records an inspection. The database works out the result itself and opens the remake line when it is a fail. */
export async function recordInspection(admin: Admin, actor: string, input: InspectionToRecord): Promise<RecordedInspection> {
  const { data, error } = await admin.rpc("ops_record_inspection", {
    p_actor: actor,
    p_order_id: input.orderId,
    p_checklist: input.checklist.map((c) => ({ key: c.key, result: c.result, note: c.note })),
    p_measurements: input.measurements,
    p_sample_size: input.sampleSize,
    p_defect_count: input.defectCount,
    p_photo_file_ids: input.photoFileIds,
    p_note: input.note,
    p_remake_sizes: input.remake?.sizes ?? null,
    p_remake_owner: input.remake?.owner ?? null,
    p_remake_due_on: input.remake?.dueOn ?? null,
    p_colour_readings: input.colourReadings.map((r) => ({
      colourName: r.colourName,
      deltaE: r.deltaE,
      limitDeltaE: r.limitDeltaE,
      method: r.method,
      instrument: r.instrument,
      whitePoint: r.whitePoint,
      observer: r.observer,
      ruleId: r.ruleId,
    })),
    p_aql_code_letter: input.aqlCodeLetter,
  });
  throwIfQcFailed(error);
  const row = (Array.isArray(data) ? data[0] : data) as { inspection_id: string; result: "pass" | "fail"; exception_id: string | null } | undefined;
  if (!row) throw new Error("ops_record_inspection answered with nothing");
  return { inspectionId: row.inspection_id, result: row.result, exceptionId: row.exception_id };
}
