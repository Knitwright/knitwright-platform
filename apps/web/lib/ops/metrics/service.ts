import type { SupabaseClient } from "@supabase/supabase-js";
import { EXCEPTION_COLUMNS, toException } from "../exceptions/rows";
import { throwIfQcFailed } from "../qc/errors";
import { toInspection } from "../qc/rows";
import { toOrder } from "../rows";
import { loadSettings } from "../service";
import { SHIPMENT_COLUMNS, toShipment } from "../shipping/rows";
import { computeMetrics, type Metrics } from "./compute";

/** Rows read for the home screen. Past this the numbers would be partial, so the screen says so instead of guessing. */
export const METRICS_ROW_LIMIT = 5000;

interface LoadedMetrics {
  readonly metrics: Metrics;
  /** True when a table had more rows than the limit and the numbers cover only the newest. */
  readonly truncated: boolean;
}

/** The console home numbers, computed from the tables with the person's own client (platform admins read all of them). */
export async function loadMetrics(client: SupabaseClient, now: Date = new Date()): Promise<LoadedMetrics> {
  const [orders, shipments, inspections, exceptions, settings] = await Promise.all([
    client.from("ops_orders").select("*").order("created_at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_shipments").select(SHIPMENT_COLUMNS).order("at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_qc_inspections").select("id, order_id, factory_profile_id, result, checklist, measurements, sample_size, defect_count, photo_file_ids, note, exception_id, at").order("at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_exceptions").select(EXCEPTION_COLUMNS).order("created_at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    loadSettings(client),
  ]);
  for (const r of [orders, shipments, inspections, exceptions]) throwIfQcFailed(r.error);
  const sets = [orders.data, shipments.data, inspections.data, exceptions.data];
  return {
    metrics: computeMetrics({
      now,
      orders: (orders.data ?? []).map(toOrder),
      shipments: (shipments.data ?? []).map(toShipment),
      inspections: (inspections.data ?? []).map(toInspection),
      exceptions: (exceptions.data ?? []).map(toException),
      settings,
    }),
    truncated: sets.some((s) => (s?.length ?? 0) >= METRICS_ROW_LIMIT),
  };
}
