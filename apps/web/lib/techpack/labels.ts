import { LABEL_LINE_KINDS, type DestinationLabel, type LabelLineKind } from "@/lib/compliance/labels";
import { whyDestinationRefused } from "@/lib/compliance/guards";
import { getType, type GarmentSpec } from "@/lib/garment";

/** The name people see for a panel, or its id when the garment has no such panel. */
export const panelLabelOf = (spec: Pick<GarmentSpec, "typeId">, panelId: string): string =>
  getType(spec.typeId)?.panels.find((panel) => panel.id === panelId)?.label ?? panelId;

/**
 * The "Labels & packaging" tab, per destination market (`docs/spec/02-features.md`, tech pack view:
 * "Care, size and brand labels per destination market… Auto-generated per market"). Plan v5 Z8 and
 * decision 0089 put the generating in `lib/compliance/labels.ts`, which reads the market's row, the fabric's
 * row and the ISO 3758 rows; this turns one of its labels into the rows the tab shows.
 *
 * A row's value is deliberately `string | null` rather than a `Cell`. A `Cell` carries a `Provenance`, and
 * none of that enum's words is true of a line generated from a market rule and a standard: "Worked out from
 * other values" would read as the platform's own derivation of something that is in fact a regulation. So
 * each row carries its source as the quoted text the row itself holds, which is what a factory and an auditor
 * both need to see.
 */

export const LABEL_ROW_TITLES: Readonly<Record<LabelLineKind, string>> = {
  fibre: "Fibre content",
  care: "Care",
  origin: "Country of origin",
  size: "Size",
  importer: "Importer",
  certification: "Certification",
};

export interface DestinationLabelRow {
  readonly kind: LabelLineKind;
  readonly label: string;
  /** What the label says, or null while nothing may be printed for it. */
  readonly value: string | null;
  /** Where those words came from, quoted. Null exactly when `value` is null. */
  readonly source: string | null;
  readonly confirmed: boolean;
  readonly ruleId: string;
}

export interface DestinationLabelSection {
  /** ISO 3166 alpha-2, or EU. */
  readonly country: string;
  readonly title: string;
  readonly rows: readonly DestinationLabelRow[];
  /** One sentence saying why this label may not go to a factory, or null when it may. */
  readonly note: string | null;
  readonly usable: boolean;
  /** The market row's own provenance label, shown beside the section. */
  readonly label: string | null;
}

/**
 * One section per market. Every line kind gets a row, so a market with no care wording shows an empty Care
 * row rather than leaving the reader to notice that a line is absent. A row is filled only from a printable
 * line, so nothing unsourced reaches this tab.
 */
export function destinationLabelSection(label: DestinationLabel): DestinationLabelSection {
  const by = new Map(label.lines.map((line) => [line.kind, line]));
  const rows = LABEL_LINE_KINDS.map((kind): DestinationLabelRow => {
    const line = label.usable ? by.get(kind) : undefined;
    return {
      kind,
      label: LABEL_ROW_TITLES[kind],
      value: line?.text ?? null,
      source: line?.source ?? null,
      confirmed: line?.confirmed ?? false,
      ruleId: line?.ruleId ?? (label.findings.find((found) => found.path.endsWith(`.${kind}`))?.ruleId ?? "R-GAP-000"),
    };
  });
  return {
    country: label.country,
    title: label.countryName,
    rows,
    note: whyDestinationRefused(label.findings),
    usable: label.usable,
    label: label.label,
  };
}

export const destinationLabelSections = (labels: readonly DestinationLabel[]): readonly DestinationLabelSection[] =>
  labels.map(destinationLabelSection);

/** How many markets a design may actually be labelled for. The Review tab counts with it. */
export const usableLabelCount = (labels: readonly DestinationLabel[]): number => labels.filter((label) => label.usable).length;
