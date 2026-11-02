import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import { exportTargetSchema, marketingSnapshotSchema, watermarkRuleSchema } from "./schemas";
import type { ExportTarget, WatermarkRule } from "./export/targets";
import type { MarketingGroup, MarketingFormat, MarketingSlot } from "./templates/types";

/**
 * READING THE ROWS (plan v5 L4, decision 0094).
 *
 * Reads go through the signed-in member's own client, so the database's own rules decide what they
 * see, exactly as the template library's reads do (`lib/templates/service.ts`). Nothing here writes:
 * the two settings tables and the library are platform data, and the seed writes them with the
 * service client.
 *
 * A row that does not parse is a row nothing is drawn from. That is not strictness for its own
 * sake: a layout with a slot off the artboard, or a target naming a resolution the panel cannot
 * honour, would be a screen that offers something it cannot do.
 */

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

const TARGET_COLUMNS = "key, label, lead, file_format, colour_space, dpi, scale, quick, sort, rule_id, note";
const RULE_COLUMNS = "plan, label, watermarked, max_dpi, rule_id, note";
const TEMPLATE_COLUMNS = "id, slug, title, snapshot";

/** The library is small and platform-owned, as the design library is. */
const READ_LIMIT = 200;

/** What the export panel offers, in the order the rows give. */
export async function listExportTargets(client: SupabaseClient): Promise<readonly ExportTarget[]> {
  const { data, error } = await client.from("marketing_export_targets").select(TARGET_COLUMNS).order("sort").limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(exportTargetSchema).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map((row) => ({
    key: row.key,
    label: row.label,
    lead: row.lead,
    format: row.file_format,
    colourSpace: row.colour_space,
    dpi: row.dpi,
    scale: row.scale,
    quick: row.quick,
    sort: row.sort,
    ruleId: row.rule_id,
    note: row.note,
  }));
}

/** Which exports carry the watermark, and at what resolution each plan stops. */
export async function listWatermarkRules(client: SupabaseClient): Promise<readonly WatermarkRule[]> {
  const { data, error } = await client.from("marketing_watermark_rules").select(RULE_COLUMNS).order("plan").limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(watermarkRuleSchema).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data.map((row) => ({
    plan: row.plan,
    label: row.label,
    watermarked: row.watermarked,
    maxDpi: row.max_dpi,
    ruleId: row.rule_id,
    note: row.note,
  }));
}

/** One marketing template as the panel uses it: the row's own words and the layout in its snapshot. */
export interface MarketingTemplateView {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly group: MarketingGroup;
  readonly format: MarketingFormat;
  readonly layoutKey: string;
  readonly lead: string;
  readonly label: string;
  readonly ruleId: string;
  readonly slots: readonly MarketingSlot[];
}

const templateRow = z.object({ id: z.uuid(), slug: z.string(), title: z.string(), snapshot: marketingSnapshotSchema });

/**
 * The marketing templates in the library, in slug order. A row whose layout does not parse is left
 * out and the rest are shown: one bad row must not empty the panel.
 */
export async function listMarketingTemplates(client: SupabaseClient): Promise<readonly MarketingTemplateView[]> {
  const { data, error } = await client.from("templates").select(TEMPLATE_COLUMNS).eq("kind", "marketing").order("slug").limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const rows = z.array(z.unknown()).safeParse(data);
  if (!rows.success) throw unreadable(rows.error);
  return rows.data.flatMap((row) => {
    const parsed = templateRow.safeParse(row);
    if (!parsed.success) return [];
    const { id, slug, title, snapshot } = parsed.data;
    return [{ id, slug, title, group: snapshot.group, format: snapshot.format, layoutKey: snapshot.layoutKey, lead: snapshot.lead, label: snapshot.label, ruleId: snapshot.ruleId, slots: snapshot.slots }];
  });
}
