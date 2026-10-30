import type { BaseArticle, OptionDef, ParameterDef } from "@/lib/catalogue";
import { GAP_RULE, type KppField } from "../model";
import { chosenFabric, type KppRows } from "./model";

/**
 * The overview fields of the package (docs/spec/04, page 1 of the tech pack, "Every field carries provenance").
 * Each one is one row's value with that row's rule id beside it. `from_base` is the catalogue's and the factory's
 * own data, `from_design` is what the brand chose; nothing here is `confirmed`, because no factory has signed any
 * of these rows off yet (every seed is labelled "not reviewed by a factory").
 */

const field = (id: string, label: string, value: string | null, provenance: KppField["provenance"], ruleId = GAP_RULE): KppField => ({ id, label, value, provenance, ruleId });

/** A field only when the row has a value: a blank optional field would stop the package for nothing. */
const when = (id: string, label: string, value: string | null, provenance: KppField["provenance"], ruleId = GAP_RULE): KppField[] =>
  value === null || value.trim() === "" ? [] : [field(id, label, value, provenance, ruleId)];

const fabricLine = (rows: KppRows): string | null => {
  const code = rows.object.article.fabric.code;
  const fabric = chosenFabric(rows);
  if (fabric === null) return null;
  const gsm = fabric.gsmMin === null ? null : fabric.gsmMax === null || fabric.gsmMax === fabric.gsmMin ? `${fabric.gsmMin} gsm` : `${fabric.gsmMin}-${fabric.gsmMax} gsm`;
  return [code, fabric.name, fabric.blend, gsm].filter((part) => part !== null && part !== "").join(", ");
};

/**
 * One field per option group the article has.
 *
 * The design object holds the garment registry's own option keys (`collar: "none"`), and the catalogue holds
 * catalogue codes (`C01`, `K01`, `P00`). Nothing maps the two yet — X1's registry map joins articles to garment
 * types, not options to options — so a choice that is not one of the article's codes is written as the design's own
 * word with `R-GAP-000` and the sentence that no catalogue code is mapped. It is never silently replaced by the
 * article's default, which would put a collar on a design that asked for none.
 */
function optionFields(article: BaseArticle, chosen: Readonly<Record<string, string>>): KppField[] {
  const byGroup = new Map<string, OptionDef[]>();
  for (const option of article.options) byGroup.set(option.group, [...(byGroup.get(option.group) ?? []), option]);
  return [...byGroup.keys()].sort().flatMap((group) => {
    const label = `Option: ${group.replaceAll("_", " ")}`;
    const options = byGroup.get(group) ?? [];
    const chose = chosen[group];
    const coded = options.find((option) => option.code === chose);
    if (coded !== undefined) return [field(`option_${group}`, label, `${coded.code} ${coded.label}`, "from_design", coded.ruleId)];
    if (chose !== undefined) return [field(`option_${group}`, label, `${chose} (not yet mapped to a catalogue code)`, "from_design")];
    const fallback = options.find((option) => option.isDefault) ?? options[0];
    return fallback === undefined ? [] : [field(`option_${group}`, label, `${fallback.code} ${fallback.label}`, "from_base", fallback.ruleId)];
  });
}

const parameterValue = (def: ParameterDef, value: number | string | boolean | undefined): string => {
  const chosen = value ?? def.defaultValue;
  return typeof chosen === "boolean" ? (chosen ? "yes" : "no") : `${chosen}${def.unit === null ? "" : ` ${def.unit}`}`;
};

/** One field per structural parameter the article defines, with the value the design set or the article's default. */
const parameterFields = (article: BaseArticle, chosen: Readonly<Record<string, number | string | boolean>>): KppField[] =>
  [...article.parameters]
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((def) =>
      field(
        `parameter_${def.key}`,
        `Parameter: ${def.key.replaceAll("_", " ")}`,
        parameterValue(def, chosen[def.key]),
        chosen[def.key] === undefined ? "from_base" : "from_design",
        def.ruleId,
      ),
    );

/** Every overview field, in a fixed order, so the same rows always give the same package. */
export function overviewFields(rows: KppRows): readonly KppField[] {
  const { article, design, factory } = rows;
  return [
    field("brand", "Brand", design.brand, "from_design"),
    field("style_name", "Style name", design.name, "from_design"),
    field("style_number", "Style number", design.code, "from_design"),
    ...when("season", "Season", design.season, "from_design"),
    field("revision", "Revision", `v${design.version}`, "from_design"),
    field("base_article", "Base article", `${article.code} ${article.name}`, "from_base"),
    field("production_class", "Production class", article.productionClass, "from_base"),
    ...when("fit", "Fit", article.fit, "from_base"),
    field("size_range", "Size range", article.sizeRange.join(", "), "from_base"),
    field("base_size", "Base size", article.sampleSize, "from_base"),
    field("fabric", "Fabric", fabricLine(rows), chosenFabric(rows) === null ? "needs_input" : "from_base", chosenFabric(rows)?.ruleId ?? GAP_RULE),
    field("factory", "Factory", `${factory.name}, ${factory.city}`, "from_base"),
    ...when("hs_code", "HS code", article.hsCode, "from_base"),
    ...when("origin", "Country of origin", article.origin, "from_base"),
    ...optionFields(article, rows.object.article.options),
    ...parameterFields(article, rows.object.article.parameters),
  ];
}
