import type { BaseArticle } from "@/lib/catalogue";
import { humanise, optionGroups, parameterSliders, signedMm, type OptionGroupView, type ParameterSlider } from "@/lib/editor";
import { KIT_PATTERN_LABELS, WEARERS, type Wearer } from "@/lib/garment";
import { kitStylesFor } from "@/lib/kit-styles/presets";
import { wearerLabel } from "@/lib/projects/wearers";
import { ELEMENT_SLOTS, ELEMENT_SLOT_LABELS, type KitPart, type PartChoice, type TeamwearKit } from "./kit";
import { GAP_RULE_ID, RULES } from "./vocabulary";

/**
 * The right panel's accordion (spec F-T1): one row per decision, each showing its current value as
 * a short catalogue code, so "the factory and the club use the same reference".
 *
 * The rows come from the base article's own option groups, not from a list written here: the spec's
 * mock-up names three rows ("Pattern & design", "Collar & cuffs"), while the catalogue holds the
 * groups `collar`, `sleeve_finish` and `pattern_fill`. The catalogue wins, because its group name
 * is the reference the factory reads (decision 0086).
 */

export const MODEL_ROW = "model";
export const COLOURS_ROW = "colours";
export const PATTERN_ROW = "pattern";
export const PARAMETERS_ROW = "parameters";
export const ELEMENTS_ROW = "elements";
export const NAMES_ROW = "names-numbers";

export const optionRowId = (group: string): string => `option:${group}`;

/** What a row shows when it is closed, and which control it opens. */
export type PanelRow =
  | Readonly<{ kind: "model"; id: string; label: string; value: string; note: string | null; wearers: readonly Wearer[]; wearer: Wearer; ruleId: string; settled: boolean }>
  | Readonly<{ kind: "colours"; id: string; label: string; value: string; swatches: readonly string[]; ruleId: string; settled: boolean }>
  | Readonly<{ kind: "options"; id: string; label: string; value: string; group: OptionGroupView; ruleId: string; settled: boolean }>
  | Readonly<{ kind: "pattern"; id: string; label: string; value: string; styles: readonly Readonly<{ id: string; label: string }>[]; ruleId: string; settled: boolean }>
  | Readonly<{ kind: "parameters"; id: string; label: string; value: string; sliders: readonly ParameterSlider[]; ruleId: string; settled: boolean }>
  | Readonly<{ kind: "elements"; id: string; label: string; value: string; slots: readonly Readonly<{ id: string; label: string; filled: boolean }>[]; note: string; ruleId: string; settled: boolean }>
  | Readonly<{ kind: "names-numbers"; id: string; label: string; value: string; on: boolean; note: string; ruleId: string; settled: boolean }>;

/** Said plainly where a part has no base article: the colour is all the catalogue can hold for it. */
export const NO_ARTICLE_NOTE = "No base article covers this part yet, so it carries a colour only: no options, no measurements and no price.";

/** Said plainly on the element row: where each element sits comes from the base article, which the catalogue does not carry yet. */
export const ELEMENT_NOTE =
  "The slots are the ones the spec fixes. Where each one sits on the garment comes from the base article's placement table, which the catalogue does not carry yet, and the artwork itself is added in the Studio editor.";

/** Said plainly on the names and numbers row. */
export const NAMES_NOTE = "Names and numbers are printed in the same sublimation pass, so they add no extra layer.";

const swatchesOf = (kit: TeamwearKit): readonly string[] =>
  [kit.colours.main, kit.colours.second, ...(kit.colours.third === null ? [] : [kit.colours.third])];

const modelRow = (kit: TeamwearKit, part: KitPart, article: BaseArticle | null, choice: PartChoice): PanelRow => ({
  kind: "model",
  id: MODEL_ROW,
  label: "Model & fit",
  value: article === null ? part.typeId : `${article.code} · ${article.fit ?? "fit not stated"} · ${wearerLabel(kit.wearer)}`,
  note: article === null ? NO_ARTICLE_NOTE : article.dataLabel,
  wearers: WEARERS,
  wearer: kit.wearer,
  ruleId: GAP_RULE_ID,
  settled: choice.settled.includes(MODEL_ROW),
});

const coloursRow = (kit: TeamwearKit, choice: PartChoice, part: KitPart): PanelRow => {
  const swatches = part.id === "socks" ? [kit.socksColour] : swatchesOf(kit);
  return {
    kind: "colours",
    id: COLOURS_ROW,
    label: "Colours",
    value: swatches.join(" · "),
    swatches,
    ruleId: GAP_RULE_ID,
    settled: choice.settled.includes(COLOURS_ROW),
  };
};

const optionRow = (group: OptionGroupView, choice: PartChoice): PanelRow => {
  const tile = group.tiles.find((entry) => entry.chosen);
  return {
    kind: "options",
    id: optionRowId(group.group),
    label: group.label,
    value: tile ? `${tile.code} · ${tile.label}` : "Nothing to choose yet",
    group,
    ruleId: tile?.ruleId ?? GAP_RULE_ID,
    settled: choice.settled.includes(optionRowId(group.group)),
  };
};

const patternRow = (part: KitPart, choice: PartChoice): PanelRow => {
  const styles = kitStylesFor(part.typeId).map((style) => ({ id: style.id, label: style.label }));
  const label = choice.pattern === "plain" ? "Plain" : KIT_PATTERN_LABELS[choice.pattern];
  return {
    kind: "pattern",
    id: PATTERN_ROW,
    label: "Pattern & design",
    value: label,
    styles,
    ruleId: RULES.patternCost,
    settled: choice.settled.includes(PATTERN_ROW),
  };
};

const parametersRow = (sliders: readonly ParameterSlider[], choice: PartChoice): PanelRow => ({
  kind: "parameters",
  id: PARAMETERS_ROW,
  label: "Measurements the factory approves",
  value: sliders.map((slider) => `${humanise(slider.key)} ${signedMm(slider.value)}`).join(" · "),
  sliders,
  ruleId: sliders[0]?.ruleId ?? GAP_RULE_ID,
  settled: choice.settled.includes(PARAMETERS_ROW),
});

const elementsRow = (kit: TeamwearKit, choice: PartChoice): PanelRow => {
  const slots = ELEMENT_SLOTS.map((id) => ({ id, label: ELEMENT_SLOT_LABELS[id], filled: kit.elements.includes(id) }));
  const used = slots.filter((slot) => slot.filled).length;
  return {
    kind: "elements",
    id: ELEMENTS_ROW,
    label: "Crest & sponsors",
    value: `${used} of ${slots.length} slots used`,
    slots,
    note: ELEMENT_NOTE,
    ruleId: RULES.elementPlacement,
    settled: choice.settled.includes(ELEMENTS_ROW),
  };
};

const namesRow = (kit: TeamwearKit, choice: PartChoice): PanelRow => ({
  kind: "names-numbers",
  id: NAMES_ROW,
  label: "Names & numbers",
  value: kit.namesNumbers ? "On" : "Off",
  on: kit.namesNumbers,
  note: NAMES_NOTE,
  ruleId: RULES.personalisationMethod,
  settled: choice.settled.includes(NAMES_ROW),
});

/**
 * Every row of one part, in the order the panel lists them. A part with no base article has the
 * model row and the colour row only: there is nothing else the catalogue can offer for it.
 */
export function panelRows(kit: TeamwearKit, part: KitPart, article: BaseArticle | null, choice: PartChoice): readonly PanelRow[] {
  const rows: PanelRow[] = [modelRow(kit, part, article, choice), coloursRow(kit, choice, part)];
  if (article === null) return rows;
  const sliders = parameterSliders(article, choice.form);
  const patterns = kitStylesFor(part.typeId);
  for (const group of optionGroups(article, choice.form)) rows.push(optionRow(group, choice));
  if (patterns.length > 0) rows.push(patternRow(part, choice));
  if (sliders.length > 0) rows.push(parametersRow(sliders, choice));
  rows.push(elementsRow(kit, choice), namesRow(kit, choice));
  return rows;
}

/**
 * The rows a part has to settle before its pill ticks: who it is made for, its colours and each of
 * its option groups. The pattern, the measurements, the elements and the names are all optional, so
 * a club that wants a plain kit in its own colours is finished.
 */
export const requiredRows = (rows: readonly PanelRow[]): readonly string[] =>
  rows.filter((row) => row.kind === "model" || row.kind === "colours" || row.kind === "options").map((row) => row.id);

/** Whether a part is done, which is what the tick on its pill means. */
export const partDone = (rows: readonly PanelRow[]): boolean => requiredRows(rows).every((id) => rows.find((row) => row.id === id)?.settled === true);
