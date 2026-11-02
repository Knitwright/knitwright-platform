import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { EXCEPTION_COLUMNS, toException } from "../exceptions/rows";
import { METRICS_ROW_LIMIT } from "../metrics/service";
import { throwIfQcFailed } from "../qc/errors";
import { toOrder } from "../rows";
import { SHIPMENT_COLUMNS, toShipment } from "../shipping/rows";
import { buildScorecards, type ArticleGoldenSample, type FactoryScorecard, type ScorecardReading } from "./compute";

/**
 * The rows the scorecard is counted from. The orders, shipments, inspections and exceptions are read with the
 * person's own client (platform admins read them); the factories and what each makes are read with the
 * server's own key, because no browser role reaches those tables at all (decision 0071).
 */

const inspectionRow = z.object({ id: z.string(), factory_profile_id: z.string(), result: z.enum(["pass", "fail"]), sample_size: z.number().int(), defect_count: z.number().int() });
const readingRow = z.object({ inspection_id: z.string(), delta_e: z.coerce.number(), limit_delta_e: z.coerce.number().nullable() });
const factoryRow = z.object({ id: z.string(), slug: z.string(), name: z.string() });
const capabilityRow = z.object({ factory_id: z.string(), article_code: z.string(), golden_sample_status: z.enum(["none", "requested", "approved", "rejected"]) });

export interface LoadedScorecards {
  readonly cards: readonly FactoryScorecard[];
  /** True when a table had more rows than the limit, so the card covers only the newest. */
  readonly truncated: boolean;
}

/** Every factory's card, as of `now`. */
export async function loadScorecards(client: SupabaseClient, admin: SupabaseClient, now: Date = new Date()): Promise<LoadedScorecards> {
  const [orders, shipments, inspections, readings, exceptions, factories, capabilities] = await Promise.all([
    client.from("ops_orders").select("*").order("created_at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_shipments").select(SHIPMENT_COLUMNS).order("at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_qc_inspections").select("id, factory_profile_id, result, sample_size, defect_count").order("at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_qc_colour_readings").select("inspection_id, delta_e, limit_delta_e").order("at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    client.from("ops_exceptions").select(EXCEPTION_COLUMNS).order("created_at", { ascending: false }).limit(METRICS_ROW_LIMIT),
    admin.from("factories").select("id, slug, name").order("name").limit(500),
    admin.from("factory_capabilities").select("factory_id, article_code, golden_sample_status").order("article_code").limit(2000),
  ]);
  for (const r of [orders, shipments, inspections, readings, exceptions]) throwIfQcFailed(r.error);

  const parsedInspections = z.array(inspectionRow).parse(inspections.data ?? []);
  const factoryOfInspection = new Map(parsedInspections.map((i) => [i.id, i.factory_profile_id]));
  const parsedFactories = z.array(factoryRow).safeParse(factories.data ?? []).data ?? [];
  const slugOfFactory = new Map(parsedFactories.map((f) => [f.id, f.slug]));
  const golden: ArticleGoldenSample[] = (z.array(capabilityRow).safeParse(capabilities.data ?? []).data ?? []).flatMap((c) => {
    const slug = slugOfFactory.get(c.factory_id);
    return slug ? [{ factoryProfileId: slug, articleCode: c.article_code, state: c.golden_sample_status }] : [];
  });
  const colour: ScorecardReading[] = z
    .array(readingRow)
    .parse(readings.data ?? [])
    .flatMap((r) => {
      const slug = factoryOfInspection.get(r.inspection_id);
      return slug ? [{ factoryProfileId: slug, deltaE: r.delta_e, limitDeltaE: r.limit_delta_e }] : [];
    });

  const sets = [orders.data, shipments.data, inspections.data, readings.data, exceptions.data];
  return {
    cards: buildScorecards({
      now,
      orders: (orders.data ?? []).map(toOrder),
      shipments: (shipments.data ?? []).map(toShipment),
      inspections: parsedInspections.map((i) => ({ factoryProfileId: i.factory_profile_id, result: i.result, sampleSize: i.sample_size, defectCount: i.defect_count })),
      readings: colour,
      exceptions: (exceptions.data ?? []).map(toException),
      goldenSamples: golden,
      factories: parsedFactories.map((f) => ({ slug: f.slug, name: f.name })),
    }),
    truncated: sets.some((s) => (s?.length ?? 0) >= METRICS_ROW_LIMIT),
  };
}
