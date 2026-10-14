import type { Cell } from "./cell";
import { listOf, sentenceCase } from "./text";
import type { SectionId, TechPack } from "./types";
import { SECTION_IDS, SECTION_TITLES } from "./types";

export interface ConfirmItem {
  readonly sectionId: SectionId;
  readonly sectionTitle: string;
  /** What is missing, for example "Chest width". */
  readonly label: string;
  /** Which part of it is missing, or null when the label says it all. */
  readonly detail: string | null;
  /**
   * Names the thing within its section, so a screen can take the person to the field that
   * fills it: a cover field, a point of measure, "fabric:" and a fabric id, a component slot id, a seam id, a
   * colourway id and panel id joined by a colon, or a labelling field.
   */
  readonly target: string;
}

export interface ConfirmSection {
  readonly id: SectionId;
  readonly title: string;
  readonly items: readonly ConfirmItem[];
}

export interface CompletenessReport {
  /** How many things are still to be confirmed. */
  readonly total: number;
  /** Only the sections that have something to confirm. */
  readonly sections: readonly ConfirmSection[];
  /** How many things are suggestions that the brand has not confirmed. They are not counted in the total. */
  readonly suggested: number;
  /** How many things the platform proposes and nobody has confirmed. They are not counted in the total. */
  readonly proposed: number;
}

/**
 * One sentence for the top of the page. It counts empty fields only. It never says that
 * nothing is left, because suggestions and proposals are still not confirmed by anyone.
 */
export function confirmSentence(report: Pick<CompletenessReport, "total" | "suggested" | "proposed">): string {
  if (report.total === 1) return "1 thing to confirm.";
  if (report.total > 1) return `${report.total} things to confirm.`;
  return report.suggested + report.proposed === 0
    ? "No empty fields."
    : "No empty fields. Suggestions and proposed stitching are still not confirmed by anyone.";
}

/** The parts of the document the report reads. */
export type CompletenessSource = Pick<TechPack, "cover" | "measurements" | "components" | "construction" | "colourways" | "labelling" | "suggested">;

const missing = (cell: Cell): boolean => cell.status !== "set";

const named = (parts: readonly (readonly [Cell, string])[]): string | null => {
  const words = parts.filter(([cell]) => missing(cell)).map(([, word]) => word);
  return words.length === 0 ? null : sentenceCase(listOf(words));
};

const item = (sectionId: SectionId, target: string, label: string, detail: string | null): ConfirmItem => ({
  sectionId,
  sectionTitle: SECTION_TITLES[sectionId],
  label,
  detail,
  target,
});

function coverItems(pack: CompletenessSource): ConfirmItem[] {
  const { cover } = pack;
  const fields: readonly (readonly [Cell, string, string])[] = [
    [cover.styleNumber, "styleNumber", "Style number"],
    [cover.season, "season", "Season"],
    [cover.brand, "brand", "Brand"],
    [cover.designName, "designName", "Design name"],
    [cover.garmentType, "garmentType", "Garment type"],
    [cover.wearer, "wearer", "Wearer"],
    [cover.baseSize, "baseSize", "Base size"],
    [cover.sizeRun, "sizeRun", "Size run"],
  ];
  return fields.filter(([cell]) => missing(cell)).map(([, target, label]) => item("cover", target, label, null));
}

function measurementItems(pack: CompletenessSource): ConfirmItem[] {
  const { columns, groups } = pack.measurements;
  return groups.flatMap((group) =>
    group.rows.flatMap((row) => {
      const gaps = columns.flatMap((column, index) => (missing(row.values[index] ?? row.tolerance) ? [column.size] : []));
      const sizes = gaps.flatMap((size) => (size === null ? [] : [size]));
      const value = gaps.length === 0 ? null : sizes.length === 0 ? "The value" : `The value for ${sizes.length === 1 ? "size" : "sizes"} ${listOf(sizes)}`;
      const tolerance = missing(row.tolerance) ? "the tolerance" : null;
      if (value === null && tolerance === null) return [];
      const joined = value !== null && tolerance !== null ? `${value}${sizes.length > 0 ? ", and " : " and "}${tolerance}` : (value ?? sentenceCase(tolerance ?? ""));
      return [item("measurements", row.pointId, row.label, joined)];
    }),
  );
}

function componentItems(pack: CompletenessSource): ConfirmItem[] {
  const fabrics = pack.components.fabrics.flatMap((line) => {
    const detail = named([
      [line.composition, "composition"],
      [line.construction, "construction"],
      [line.weight, "weight"],
      [line.finish, "finish"],
      [line.stretch, "stretch"],
      [line.consumption, "consumption"],
    ]);
    const label = `Fabric for ${listOf(line.panels.map((panel) => panel.label))}`;
    return detail === null ? [] : [item("components", `fabric:${line.fabricId}`, label, detail)];
  });
  const others = pack.components.others.flatMap((line) => {
    const detail = named([
      [line.name, "name"],
      [line.details, "details"],
      [line.quantity, "quantity"],
    ]);
    return detail === null ? [] : [item("components", line.slotId, line.label, detail)];
  });
  return [...fabrics, ...others];
}

const constructionItems = (pack: CompletenessSource): ConfirmItem[] =>
  pack.construction.seams
    .filter((seam) => missing(seam.stitchDensity))
    .map((seam) => item("construction", seam.seamId, seam.label, "Stitch density"));

const colourwayItems = (pack: CompletenessSource): ConfirmItem[] =>
  pack.colourways.colourways.flatMap((block) =>
    block.rows.flatMap((row) => {
      const detail = named([
        [row.code, "colour code"],
        [row.screenColour, "screen colour"],
      ]);
      return detail === null ? [] : [item("colourways", `${block.id}:${row.panelId}`, `${block.name}: ${row.label}`, detail)];
    }),
  );

const labellingItems = (pack: CompletenessSource): ConfirmItem[] =>
  pack.labelling.rows.filter((row) => missing(row.value)).map((row) => item("labelling", row.field, row.label, null));

/**
 * What is still to be confirmed, section by section, so a screen or an export can say
 * "12 things to confirm" and list them. A thing is a row: a measurement with a gap in it counts
 * once. The sign-off is empty on purpose and is not counted.
 */
export function completenessReport(pack: CompletenessSource): CompletenessReport {
  const found: readonly ConfirmItem[] = [
    ...coverItems(pack),
    ...measurementItems(pack),
    ...componentItems(pack),
    ...constructionItems(pack),
    ...colourwayItems(pack),
    ...labellingItems(pack),
  ];
  const sections = SECTION_IDS.flatMap((id) => {
    const items = found.filter((entry) => entry.sectionId === id);
    return items.length === 0 ? [] : [{ id, title: SECTION_TITLES[id], items }];
  });
  return { total: found.length, sections, suggested: pack.suggested.items.length, proposed: pack.suggested.proposals.length };
}
