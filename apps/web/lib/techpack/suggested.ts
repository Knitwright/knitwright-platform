import { provenanceSummary, type GarmentSpec, type Provenance, type ProvenanceItem } from "@/lib/garment";
import type { ChartSet } from "@/lib/sizing";
import { buildMeasurements } from "./measurements";
import { listOf } from "./text";
import type { MeasurementsSection, SectionId, SuggestedItem, SuggestedSection } from "./types";
import { SECTION_TITLES } from "./types";

/** The sources that mean a value is a suggestion, so the brand should confirm it. */
export const SUGGESTION_SOURCES: readonly Provenance[] = ["suggested-chart", "ai-suggested", "read-from-image"];

const NONE = "Nothing in this document is a suggestion from a size chart, the assistant or a picture.";
const SOME = "Every value on this page is a suggestion. Confirm each one, or replace it with your own.";

const WHERE: Readonly<Record<ProvenanceItem["kind"], SectionId>> = {
  option: "cover",
  measurement: "measurements",
  fabric: "components",
  component: "components",
  colour: "colourways",
  artwork: "artwork",
  construction: "construction",
  labelling: "labelling",
};

const item = (sectionId: SectionId, label: string, provenance: Provenance): SuggestedItem => ({
  sectionId,
  sectionTitle: SECTION_TITLES[sectionId],
  label,
  provenance,
});

const sizesText = (sizes: readonly string[]): string => `${sizes.length === 1 ? "size" : "sizes"} ${listOf(sizes)}`;

/** The values in the table that came from a chart, the assistant or a picture, one item for each point and source. */
function tableItems(table: MeasurementsSection): SuggestedItem[] {
  return table.groups.flatMap((group) =>
    group.rows.flatMap((row) => {
      const found = SUGGESTION_SOURCES.flatMap((source) => {
        const sizes = row.values.flatMap((value, index) =>
          value.status === "set" && value.provenance === source ? [table.columns[index]?.size ?? null] : [],
        );
        if (sizes.length === 0) return [];
        const named = sizes.flatMap((size) => (size === null ? [] : [size]));
        const label = named.length > 0 ? `${row.label}: value for ${sizesText(named)}` : row.label;
        return [item("measurements", label, source)];
      });
      const tolerance = row.tolerance.status === "set" ? [item("measurements", `${row.label}: tolerance`, row.tolerance.provenance)] : [];
      return [...found, ...tolerance];
    }),
  );
}

/**
 * Every value in the document that is a suggestion, with where it appears, so the brand can
 * confirm each one. It uses the design's own list and adds the values that come from size
 * charts. A point of measure is listed once, from the table.
 */
export function buildSuggested(spec: GarmentSpec, charts?: ChartSet, table?: MeasurementsSection): SuggestedSection {
  const fromTable = tableItems(table ?? buildMeasurements(spec, charts));
  const summary = provenanceSummary(spec);
  const inTable = new Set(fromTable.map((entry) => entry.label.split(":")[0]));
  const fromDesign = (kind: string) => summary.filter((entry) => entry.kind === kind);
  const own = (entry: (typeof summary)[number]): SuggestedItem => item(WHERE[entry.kind], entry.label, entry.provenance);
  const measurementsLeft = fromDesign("measurement").filter((entry) => !inTable.has(entry.label));
  const items = [
    ...fromDesign("option").map(own),
    ...fromTable,
    ...measurementsLeft.map(own),
    ...summary.filter((entry) => entry.kind !== "option" && entry.kind !== "measurement").map(own),
  ];
  return { id: "suggested", title: SECTION_TITLES.suggested, note: items.length === 0 ? NONE : SOME, items };
}
