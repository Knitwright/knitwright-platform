import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { ConsumptionRow } from "../input/model";

/**
 * The read side of `bom_consumption` (plan v5 section 6 item 2, decision 0101): what one garment consumes, per
 * bill-of-materials line, for one base article.
 *
 * This is the row `lib/kpp/input/materials.ts` has always looked for and never found. Until this table existed
 * every BOM line came out with no quantity, no unit and `needs_input` provenance, and the F-G2 gate refused the
 * package and named each line (decision 0070 revision 2, "Still owed").
 *
 * Nothing here invents a figure. The read gives back what the table holds and no more: an article with no row
 * comes back empty, and the gate goes on refusing its package and naming the line. A figure that is here is
 * quoted from the file that publishes it and carries that file's own words about what it is worth, which for every
 * figure seeded so far is a Knitwright draft the factory confirms from its own marker.
 *
 * Reads go through the client the caller passes, as the catalogue's and the option code map's reads do, so the
 * database's own rules decide what is seen; a signed-in member may read the table, so the server's key is not
 * needed for it. Nothing here writes: `bom_consumption_record` is the only way in, and it refuses anyone who is
 * not a platform admin.
 */

/** One article's bill of materials is a handful of lines. Beyond this the read would be paged by the database. */
const READ_LIMIT = 200;

/** The columns a read asks for. The article is found by its code first, as the catalogue's own reads do. */
export const CONSUMPTION_SELECT =
  "item_id, version, qty_per_piece, unit, size_dependent, source_file, source_label, source_quote, confirmed, rule_id";

export const consumptionDbRow = z.object({
  item_id: z.string().min(1),
  version: z.number().int().min(1),
  qty_per_piece: z.string().min(1),
  unit: z.string().min(1),
  size_dependent: z.boolean(),
  source_file: z.string().min(1),
  source_label: z.string().min(1),
  source_quote: z.string().min(1),
  confirmed: z.boolean(),
  rule_id: z.string().regex(/^R-[A-Z]+-\d{3}$/),
});

export type ConsumptionDbRow = z.infer<typeof consumptionDbRow>;

const unreadable = (cause: unknown): AppError => new AppError("internal", MESSAGES.internal, undefined, { cause });

/**
 * One row as the package's own type. The label names the file first and then what that file says the figure is
 * worth, so a BOM line a factory reads says where its quantity came from and in the same breath that nobody has
 * agreed it.
 */
export const toConsumption = (row: ConsumptionDbRow): ConsumptionRow => ({
  itemId: row.item_id,
  qtyPerPiece: row.qty_per_piece,
  unit: row.unit,
  sizeDependent: row.size_dependent,
  label: `${row.source_file}: ${row.source_label}`,
  ruleId: row.rule_id,
});

/**
 * The newest version of each line. The table is append-only, so a factory's own confirmed figure arrives as the
 * next version of that line and the one it replaces stays findable; the package is built on the newest.
 */
export function newestPerItem(rows: readonly ConsumptionDbRow[]): readonly ConsumptionDbRow[] {
  const newest = new Map<string, ConsumptionDbRow>();
  for (const row of rows) {
    const held = newest.get(row.item_id);
    if (held === undefined || row.version > held.version) newest.set(row.item_id, row);
  }
  return [...newest.values()];
}

const articleIdOf = async (client: SupabaseClient, code: string): Promise<string | null> => {
  const { data, error } = await client.from("base_articles").select("id").eq("code", code).maybeSingle();
  if (error) throw unreadable(error);
  const parsed = z.object({ id: z.uuid() }).nullable().safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return parsed.data?.id ?? null;
};

/**
 * What one garment of one base article consumes, one row per BOM line. Empty for an article nothing is recorded
 * for, which is the normal answer for seven of the eight base articles: they publish no bill of materials, and a
 * consumption is a measurement, so none was written for them.
 */
export async function bomConsumption(client: SupabaseClient, articleCode: string): Promise<readonly ConsumptionRow[]> {
  const id = await articleIdOf(client, articleCode);
  if (id === null) return [];
  const { data, error } = await client
    .from("bom_consumption")
    .select(CONSUMPTION_SELECT)
    .eq("article_id", id)
    .order("item_id")
    .order("version")
    .limit(READ_LIMIT);
  if (error) throw unreadable(error);
  const parsed = z.array(consumptionDbRow).safeParse(data);
  if (!parsed.success) throw unreadable(parsed.error);
  return newestPerItem(parsed.data).map(toConsumption);
}

const NO_FIGURES =
  "No consumption figure is on file for this article, so every bill-of-materials line comes out with no quantity and this package is refused until one is recorded for each line. What a garment consumes is measured off the factory's own marker; it is not estimated from the pattern here.";

/**
 * The sentence the package carries about its own quantities. It says how many figures were quoted and where from,
 * and it says in the same breath that no factory has agreed any of them, so a reader is never left to assume a
 * quantity was measured for them.
 */
export function consumptionNote(rows: readonly ConsumptionRow[]): string {
  if (rows.length === 0) return NO_FIGURES;
  const labels = [...new Set(rows.map((row) => row.label))].join("; ");
  const many = rows.length === 1 ? "figure" : "figures";
  return `The bill of materials quotes ${rows.length} consumption ${many}, from ${labels}. No factory has agreed any of them: what a garment consumes is measured off the factory's own marker.`;
}
