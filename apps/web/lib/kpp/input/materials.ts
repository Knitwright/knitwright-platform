import type { ArticleFabric, BaseArticle } from "@/lib/catalogue";
import type { ProgrammeFabric } from "@/lib/factory/schemas";
import { GAP_RULE, type KppBomRow } from "../model";
import type { ConsumptionRow, KppRows } from "./model";

/**
 * The bill of materials (docs/spec/04, `06_bom/bom.csv`). Each line's *specification* comes from rows: the
 * article's allowed fabrics (X1's `article_fabrics`), the programme fabric's blend and weight (X6's
 * `programme_fabrics`), the article's thread (X1) and the care label the destination market needs.
 *
 * Each line's *quantity* does not. What one garment consumes is a measurement, and no table in the platform holds
 * it: the launch articles' consumption is written only in `docs/spec/articles/<code>/article.json`, which X1 did not
 * seed. So a line with no `ConsumptionRow` comes out with no quantity, no unit and `needs_input` provenance, and
 * the F-G2 gate refuses the package and names it. Nothing is estimated from the pattern: that is the files service's
 * `nest_marker` operation, which is not available (owner decision 2).
 */

const fabricItemId = (code: string): string => `fabric:${code}`;
const THREAD_NEEDLE = "thread:needle";
const THREAD_LOOPER = "thread:looper";
const CARE_LABEL = "label:care";

type Line = Readonly<{ itemId: string; item: string; type: KppBomRow["type"]; spec: string | null; supplierRef: string | null; ruleId: string }>;

const fabricSpec = (allowed: ArticleFabric, programme: ProgrammeFabric | undefined): string | null => {
  const gsm = allowed.gsm ?? (programme?.gsmMin === null || programme?.gsmMin === undefined ? null : programme.gsmMax === null || programme.gsmMax === programme.gsmMin ? `${programme.gsmMin} gsm` : `${programme.gsmMin}-${programme.gsmMax} gsm`);
  const parts = [allowed.code, programme?.name ?? null, allowed.description ?? programme?.blend ?? null, gsm, allowed.widthCm === null ? null : `${allowed.widthCm} cm wide`];
  const spec = parts.filter((part) => part !== null && part !== "").join(", ");
  return spec === allowed.code ? null : spec;
};

/** One line per fabric the article is made of, body first, in the catalogue's own order. */
function fabricLines(article: BaseArticle, programme: readonly ProgrammeFabric[]): Line[] {
  const byCode = new Map(programme.map((fabric) => [fabric.code, fabric]));
  return article.fabrics.map((allowed) => ({
    itemId: fabricItemId(allowed.code),
    item: allowed.role === "rib" ? "Rib fabric" : allowed.role === "body" ? "Main fabric" : `Fabric ${allowed.code}`,
    type: "fabric" as const,
    spec: fabricSpec(allowed, byCode.get(allowed.code)),
    supplierRef: null,
    ruleId: byCode.get(allowed.code)?.ruleId ?? GAP_RULE,
  }));
}

function threadLines(article: BaseArticle): Line[] {
  const thread = article.thread;
  if (thread === null) return [];
  return [
    { itemId: THREAD_NEEDLE, item: "Needle thread", type: "thread", spec: thread.needle, supplierRef: null, ruleId: thread.ruleId },
    { itemId: THREAD_LOOPER, item: "Looper thread", type: "thread", spec: thread.looper, supplierRef: null, ruleId: thread.ruleId },
  ];
}

/** One care label line when at least one destination market is named: a label is a thing the factory must buy. */
const labelLines = (rows: KppRows): Line[] =>
  rows.markets.length === 0
    ? []
    : [
        {
          itemId: CARE_LABEL,
          item: "Care and fibre label",
          type: "label",
          spec: `One per garment, for ${rows.markets.map((market) => market.country).join(", ")}`,
          supplierRef: null,
          ruleId: rows.markets[0]?.ruleId ?? GAP_RULE,
        },
      ];

const withQuantity = (line: Line, consumption: ConsumptionRow | undefined): KppBomRow => ({
  item: line.item,
  type: line.type,
  spec: line.spec,
  supplierRef: line.supplierRef,
  qtyPerPiece: consumption?.qtyPerPiece ?? null,
  unit: consumption?.unit ?? null,
  sizeDependent: consumption?.sizeDependent ?? false,
  ruleId: consumption?.ruleId ?? line.ruleId,
  provenance: consumption === undefined ? "needs_input" : "from_base",
});

/** The whole bill of materials: fabric, thread and labels from rows, quantities only where one was supplied. */
export function billOfMaterials(rows: KppRows): readonly KppBomRow[] {
  const byItem = new Map(rows.unsourced.consumption.map((row) => [row.itemId, row]));
  return [...fabricLines(rows.article, rows.fabrics), ...threadLines(rows.article), ...labelLines(rows)].map((line) => withQuantity(line, byItem.get(line.itemId)));
}

/** The item ids the consumption rows are keyed by, so a caller knows what to supply. */
export const BOM_ITEM_IDS = { fabric: fabricItemId, needleThread: THREAD_NEEDLE, looperThread: THREAD_LOOPER, careLabel: CARE_LABEL } as const;
