import type { BaseArticle } from "@/lib/catalogue";
import type { GarmentSpec } from "@/lib/garment";
import type { ArtworkRow } from "@/lib/projects/artwork-controls";
import type { ColourRow } from "@/lib/projects/colour-controls";
import type { NamesNumbersPanel } from "@/lib/projects/names-numbers-controls";
import { fabricSummary, trimSummary } from "@/lib/workspace/summaries";
import { toolForSection, type SectionId, type ToolId } from "@/lib/workspace/tools";
import { optionGroups } from "./form";
import type { FormValues, SummarySectionId } from "./slots";
import { SUMMARY_SECTIONS } from "./slots";

/**
 * The right-hand Design Summary (spec F-S4): Fabrics, Colours, Pattern fills, Graphics, Names &
 * numbers, Trims & labels, Stitches. Every row says which editor opens it, and clicking it opens
 * that editor in the shell rather than taking the person anywhere.
 *
 * The lines are the ones the factory file already builds (`lib/workspace/summaries`,
 * `lib/techpack`), so the summary and the tech pack can never disagree. Stitches are read-only
 * from the base article's construction table (X1); nothing here is typed in by hand.
 */

export interface SummaryRow {
  readonly id: string;
  /** The left-hand word: a fabric code, a colour role, a seam. */
  readonly label: string;
  /** The right-hand words: the pieces it is on, the colour code, the operation. */
  readonly detail: string;
  /** The rulebook entry behind the row, for a Why? link, or null where the row is the person's own choice. */
  readonly ruleId: string | null;
}

export interface SummarySection {
  readonly id: SummarySectionId;
  readonly label: string;
  readonly rows: readonly SummaryRow[];
  /** What the section says when it has no rows yet. */
  readonly empty: string;
  /** Which editor the section's rows open. Null for a read-only section. */
  readonly opens: ToolId | null;
  /** True for a section that is read from the base article and cannot be edited here. */
  readonly readOnly: boolean;
}

const LABELS: Readonly<Record<SummarySectionId, string>> = {
  fabrics: "Fabrics",
  colours: "Colours",
  "pattern-fills": "Pattern fills",
  graphics: "Graphics",
  "names-numbers": "Names & numbers",
  "trims-labels": "Trims & labels",
  stitches: "Stitches",
};

/** Which of the shell's editors a section's rows open. Stitches open nothing: they come from the base. */
const OPENS: Readonly<Record<SummarySectionId, SectionId | null>> = {
  fabrics: "fabrics",
  colours: "colours",
  "pattern-fills": "options",
  graphics: "artwork",
  "names-numbers": "names-numbers",
  "trims-labels": "labelling",
  stitches: null,
};

const EMPTY: Readonly<Record<SummarySectionId, string>> = {
  fabrics: "No fabric chosen yet.",
  colours: "No colours chosen yet.",
  "pattern-fills": "Plain: no pattern fill.",
  graphics: "No crest, sponsor or wording yet.",
  "names-numbers": "Off.",
  "trims-labels": "No trims or labels yet.",
  stitches: "The base article has no construction table yet.",
};

/** Everything the summary is built from. All of it is already on the page: the summary fetches nothing. */
export interface SummaryInput {
  readonly spec: GarmentSpec;
  readonly article: BaseArticle | null;
  readonly form: FormValues;
  readonly colours: readonly ColourRow[];
  readonly artwork: readonly ArtworkRow[];
  readonly namesNumbers: NamesNumbersPanel | null;
}

const fabricRows = (spec: GarmentSpec): readonly SummaryRow[] =>
  fabricSummary(spec).map((card) => ({ id: card.id, label: card.title, detail: card.parts, ruleId: null }));

const colourRows = (colours: readonly ColourRow[]): readonly SummaryRow[] =>
  colours
    .filter((row) => row.hasSwatch || row.colourText.length > 0)
    .map((row) => ({ id: row.panelId, label: row.label, detail: [row.colourText, row.hasSwatch ? row.swatch : ""].filter(Boolean).join(" · "), ruleId: null }));

/** The chosen pattern-fill option of the base article, which is what a fill is on a sublimated garment. */
function fillRows(article: BaseArticle | null, form: FormValues): readonly SummaryRow[] {
  if (!article) return [];
  const group = optionGroups(article, form).find((entry) => entry.group === "pattern_fill");
  const tile = group?.tiles.find((entry) => entry.chosen);
  if (!tile || tile.isDefault) return [];
  return [{ id: tile.code, label: `${tile.code} ${tile.label}`, detail: "All panels", ruleId: tile.ruleId }];
}

const graphicRows = (artwork: readonly ArtworkRow[]): readonly SummaryRow[] =>
  artwork.map((row) => ({ id: row.id, label: row.name, detail: `${row.partLabel} · ${row.placeLabel}`, ruleId: null }));

const markRows = (marks: NamesNumbersPanel | null): readonly SummaryRow[] => {
  if (!marks?.set) return [];
  const places = marks.form.places.filter((entry) => entry.on).map((entry) => marks.placeLabels[entry.place] ?? entry.place);
  return [{ id: "names-numbers", label: "On", detail: places.join(", "), ruleId: null }];
};

const trimRows = (spec: GarmentSpec): readonly SummaryRow[] =>
  trimSummary(spec).map((fact, index) => ({ id: `${fact.label}-${index}`, label: fact.label, detail: fact.value, ruleId: null }));

/** The base article's construction table, read-only: the seam, how it is sewn, and its rule. */
const stitchRows = (article: BaseArticle | null): readonly SummaryRow[] =>
  (article?.construction ?? []).map((step) => ({ id: `${step.step}`, label: step.seam, detail: step.operation, ruleId: step.ruleId }));

const rowsOf = (section: SummarySectionId, input: SummaryInput): readonly SummaryRow[] => {
  switch (section) {
    case "fabrics":
      return fabricRows(input.spec);
    case "colours":
      return colourRows(input.colours);
    case "pattern-fills":
      return fillRows(input.article, input.form);
    case "graphics":
      return graphicRows(input.artwork);
    case "names-numbers":
      return markRows(input.namesNumbers);
    case "trims-labels":
      return trimRows(input.spec);
    default:
      return stitchRows(input.article);
  }
};

/** The whole Design Summary, in the spec's order. A section with no rows says so rather than being left out. */
export function designSummary(input: SummaryInput): readonly SummarySection[] {
  return SUMMARY_SECTIONS.map((id) => {
    const section = OPENS[id];
    return {
      id,
      label: LABELS[id],
      rows: rowsOf(id, input),
      empty: EMPTY[id],
      opens: section ? toolForSection(section) : null,
      readOnly: section === null,
    };
  });
}

/** The tool a summary section opens, and the section inside it to scroll to. */
export const summaryTarget = (id: SummarySectionId): Readonly<{ tool: ToolId; section: SectionId }> | null => {
  const section = OPENS[id];
  return section ? { tool: toolForSection(section), section } : null;
};
