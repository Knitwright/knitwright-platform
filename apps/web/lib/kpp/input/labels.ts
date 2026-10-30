import type { CountryRule } from "@/lib/factory/schemas";
import type { KppLabel } from "../model";
import { chosenFabric, type KppRows, type LabelWordingRow } from "./model";

/**
 * The care labels (docs/spec/04, `07_labels`): one per destination market, "generated per destination market from
 * `country_rule.label_rules`".
 *
 * X6 seeded `label_rules` as `{}` with a note saying the fibre, care and origin wording per market is still to be
 * written, so today every market comes out with no wording and the F-G2 gate refuses the package and names the
 * market. The one part that does come from a row is the fibre content, which is the fabric's own blend
 * (`programme_fabrics.blend`); where `label_rules` states a fibre line, that wins, because a market may require its
 * own wording and order. Care symbols, the origin sentence, the size wording and whether an importer is required
 * are never guessed: ISO 3758 symbols and a country's labelling law are not something to infer from a fabric code.
 */

/** The shape `country_rules.label_rules` takes once a market's wording is written. Anything else is ignored. */
type StoredWording = Readonly<{ fibre?: unknown; care?: unknown; origin?: unknown; size?: unknown; importer?: unknown; importer_required?: unknown }>;

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value : null);
const lines = (value: unknown): readonly string[] => (Array.isArray(value) ? value.filter((line): line is string => typeof line === "string" && line.trim() !== "") : []);

/** What one country rule's `label_rules` says, with nothing invented for what it does not say. */
export function wordingFromRule(rule: CountryRule): LabelWordingRow {
  const stored = rule.labelRules as StoredWording;
  return {
    country: rule.country,
    fibre: text(stored.fibre),
    care: lines(stored.care),
    origin: text(stored.origin),
    size: text(stored.size),
    importer: text(stored.importer),
    importerRequired: stored.importer_required === true,
  };
}

const merge = (base: LabelWordingRow, supplied: LabelWordingRow | undefined): LabelWordingRow =>
  supplied === undefined
    ? base
    : {
        country: base.country,
        fibre: base.fibre ?? supplied.fibre,
        care: base.care.length > 0 ? base.care : supplied.care,
        origin: base.origin ?? supplied.origin,
        size: base.size ?? supplied.size,
        importer: base.importer ?? supplied.importer,
        importerRequired: base.importerRequired || supplied.importerRequired,
      };

/** One care label per destination market, in the order the markets were asked for. */
export function careLabels(rows: KppRows): readonly KppLabel[] {
  const supplied = new Map(rows.unsourced.labelWording.map((row) => [row.country, row]));
  const blend = chosenFabric(rows)?.blend ?? null;
  return rows.markets.map((rule) => {
    const wording = merge(wordingFromRule(rule), supplied.get(rule.country));
    return {
      market: rule.country.toLowerCase(),
      fibre: wording.fibre ?? blend,
      care: wording.care,
      origin: wording.origin,
      size: wording.size,
      importer: wording.importer,
      importerRequired: wording.importerRequired,
      ruleId: rule.ruleId,
    };
  });
}
