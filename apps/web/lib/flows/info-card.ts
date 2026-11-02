import { formatLength, type LengthUnit } from "@/lib/units/length";
import { FLOW_GAP_RULE } from "./types";

/**
 * The Info card board (spec F-L4's board table: "size chart, colour chart, fabric and feature
 * callouts, care card, from the tech pack and the catalogue"). This is the `board-info-card` panel
 * of L1's contract.
 *
 * It is the one board in a flow that holds no picture of anything: it holds facts, and the facts are
 * the garment's own. So the two rules that matter here are about honesty rather than about pixels:
 *
 *   * **nothing is invented.** A measurement, a fabric weight or a care symbol this platform has not
 *     been given is shown as missing, with the rule that explains why it is missing. A size chart
 *     with a made-up number on it is the single most expensive thing this screen could do.
 *   * **a size chart is garment measurements**, never body measurements, because the spec's own
 *     returns rule depends on it (F-L5). The card says which it is.
 *
 * The facts come in through `InfoCardSource`, whose real implementation reads the factory file and
 * the catalogue (X1, X4, Y4). This directory defines the smallest interface it needs and a double,
 * as the plan asks (Lesson 9); the orchestrator wires the real one.
 */

export const CARD_KINDS = ["size_chart", "colour_chart", "fabric_callouts", "feature_callouts", "care_card"] as const;
export type CardKind = (typeof CARD_KINDS)[number];

export const CARD_LABELS: Readonly<Record<CardKind, string>> = {
  size_chart: "Size chart",
  colour_chart: "Colour chart",
  fabric_callouts: "Fabric callouts",
  feature_callouts: "Feature callouts",
  care_card: "Care card",
};

export const CARD_LEADS: Readonly<Record<CardKind, string>> = {
  size_chart: "Garment measurements by size, from the factory file. Not body measurements.",
  colour_chart: "The colours of this design, with the catalogue code of each.",
  fabric_callouts: "The fabric of each panel, its weight and its blend.",
  feature_callouts: "What the garment has: the seams, the fit and the finishes.",
  care_card: "How it is washed and dried, from the care symbols the platform holds.",
};

/** The words for a value nobody has given the platform. Never a number, never a guess. */
export const MISSING = "Not filled in yet";

export interface Measure {
  readonly code: string;
  readonly label: string;
  /** Millimetres by size name, as everywhere else in the platform. A size with no value is absent. */
  readonly valuesMm: Readonly<Record<string, number>>;
  readonly ruleId: string;
}

export interface ColourFact {
  readonly name: string;
  readonly hex: string | null;
  readonly code: string | null;
  readonly ruleId: string;
}

export interface FabricFact {
  readonly code: string;
  readonly name: string;
  readonly gsm: number | null;
  readonly blend: string | null;
  readonly ruleId: string;
}

export interface WordsFact {
  readonly label: string;
  readonly words: string | null;
  readonly ruleId: string;
}

/** Everything an info card can show about one design version. Nothing here is optional by accident. */
export interface InfoCardFacts {
  readonly sizes: readonly string[];
  readonly measures: readonly Measure[];
  readonly colours: readonly ColourFact[];
  readonly fabrics: readonly FabricFact[];
  readonly features: readonly WordsFact[];
  readonly care: readonly WordsFact[];
}

export interface InfoCardSource {
  facts(input: Readonly<{ designProjectId: string; version: number | null }>): Promise<InfoCardFacts>;
}

export const EMPTY_FACTS: InfoCardFacts = { sizes: [], measures: [], colours: [], fabrics: [], features: [], care: [] };

export interface CardCell {
  readonly value: string;
  /** True when there is no value and the cell says so. Drawn differently, and counted. */
  readonly missing: boolean;
  readonly ruleId: string;
}

export interface CardRow {
  /** Stable and unique within the card, because two rows can carry the same human label. */
  readonly key: string;
  readonly label: string;
  readonly cells: readonly CardCell[];
  readonly ruleId: string;
}

export interface CardSection {
  readonly heading: string;
  /** The column headings, for a card that is a table. Empty for a card that is a list. */
  readonly columns: readonly string[];
  readonly rows: readonly CardRow[];
}

export interface InfoCardView {
  readonly kind: CardKind;
  readonly title: string;
  readonly lead: string;
  readonly sections: readonly CardSection[];
  /** How many cells have no value, so the panel can say it plainly at the top. */
  readonly missing: number;
  /** What to do when the card is empty, naming the one action that fills it. */
  readonly empty: Readonly<{ title: string; body: string; action: string; ruleId: string }> | null;
  readonly ruleId: string;
}

const cell = (value: string | null, ruleId: string): CardCell =>
  value === null || value.trim().length === 0 ? { value: MISSING, missing: true, ruleId } : { value, missing: false, ruleId };

const sizeChart = (facts: InfoCardFacts, unit: LengthUnit): readonly CardSection[] => [
  {
    heading: `Garment measurements (${unit === "cm" ? "centimetres" : "inches"})`,
    columns: ["Measurement", ...facts.sizes],
    rows: facts.measures.map((measure) => ({
      key: measure.code,
      label: measure.label,
      cells: facts.sizes.map((size) => {
        const mm = measure.valuesMm[size];
        return cell(mm === undefined ? null : formatLength(mm / 10, unit), measure.ruleId);
      }),
      ruleId: measure.ruleId,
    })),
  },
];

const colourChart = (facts: InfoCardFacts): readonly CardSection[] => [
  {
    heading: "Colours",
    columns: ["Colour", "Catalogue code"],
    rows: facts.colours.map((colour, at) => ({
      key: `${at}-${colour.code ?? colour.name}`,
      label: colour.name,
      cells: [cell(colour.hex, colour.ruleId), cell(colour.code, colour.ruleId)],
      ruleId: colour.ruleId,
    })),
  },
];

const fabricCallouts = (facts: InfoCardFacts): readonly CardSection[] => [
  {
    heading: "Fabric",
    columns: ["Fabric", "Weight", "Blend"],
    rows: facts.fabrics.map((fabric) => ({
      key: fabric.code,
      label: fabric.name,
      cells: [
        cell(fabric.code, fabric.ruleId),
        cell(fabric.gsm === null ? null : `${fabric.gsm} g/m²`, fabric.ruleId),
        cell(fabric.blend, fabric.ruleId),
      ],
      ruleId: fabric.ruleId,
    })),
  },
];

const wordsSection = (heading: string, items: readonly WordsFact[]): readonly CardSection[] => [
  {
    heading,
    columns: [],
    rows: items.map((item, at) => ({ key: `${at}-${item.label}`, label: item.label, cells: [cell(item.words, item.ruleId)], ruleId: item.ruleId })),
  },
];

const EMPTY_BODY = "This card reads the garment's own facts. Put a design on the Design board and connect it to this card.";

/** The card as the panel draws it: a table or a list, every missing value said plainly. */
export function infoCard(kind: CardKind, facts: InfoCardFacts, unit: LengthUnit = "cm"): InfoCardView {
  const sections =
    kind === "size_chart"
      ? sizeChart(facts, unit)
      : kind === "colour_chart"
        ? colourChart(facts)
        : kind === "fabric_callouts"
          ? fabricCallouts(facts)
          : kind === "feature_callouts"
            ? wordsSection("Features", facts.features)
            : wordsSection("Care", facts.care);
  const rows = sections.flatMap((section) => section.rows);
  return {
    kind,
    title: CARD_LABELS[kind],
    lead: CARD_LEADS[kind],
    sections,
    missing: rows.flatMap((row) => row.cells).filter((one) => one.missing).length,
    empty:
      rows.length === 0
        ? { title: `Nothing for the ${CARD_LABELS[kind].toLowerCase()} yet`, body: EMPTY_BODY, action: "Add a Design board", ruleId: FLOW_GAP_RULE }
        : null,
    ruleId: FLOW_GAP_RULE,
  };
}

/** One sentence for the panel's own heading: how complete the card is, without rounding it up. */
export function cardNote(view: InfoCardView): string {
  if (view.empty !== null) return view.empty.body;
  if (view.missing === 0) return "Every value on this card comes from the garment's own data.";
  return `${view.missing} ${view.missing === 1 ? "value is" : "values are"} still to be filled in, and the card says so where they are.`;
}

/** A double of the source, for a test and for the panel before the real reads are wired. */
export const stubInfoCardSource = (facts: InfoCardFacts = EMPTY_FACTS): InfoCardSource => ({ facts: async () => facts });
