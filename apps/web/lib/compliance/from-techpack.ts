import { isSet, type Cell } from "@/lib/techpack/cell";
import { completenessReport } from "@/lib/techpack/completeness";
import type { ColourwaysSection, ComponentsSection, MeasurementsSection, TechPack } from "@/lib/techpack/types";
import type { DestinationLabel } from "./labels";
import { GAP_RULE_ID, type ModerationState, type ProductionClass } from "./model";
import { tbcPathsOf, type BomLine, type ColourState, type GapField, type PomState, type PreExportSubject } from "./subject";

/**
 * The tech pack Review tab as the one checklist reads it (`docs/spec/02-features.md`: "Every field still
 * 'Needs your input', plus the F-G2 pre-export check. Export is blocked until clear; no `[TBC]` is allowed").
 *
 * A tech pack cell carries its provenance but no rule id, so every gap read out of the document carries
 * `R-GAP-000`. That is listed on the PR rather than papered over with a rule that does not explain it.
 */

/** What the document does not hold and the caller must supply. */
export interface TechPackSubjectExtras {
  readonly labels: readonly DestinationLabel[];
  readonly moderation: ModerationState;
  readonly productionClass: ProductionClass;
  readonly humanAllowed: boolean | null;
  /** The colour difference the factory has agreed, from its capability row. Null: none agreed. */
  readonly colourToleranceMax: number | null;
}

type Source = Pick<TechPack, "cover" | "measurements" | "components" | "construction" | "colourways" | "labelling" | "suggested">;

const value = (cell: Cell): string | null => (isSet(cell) ? cell.value : null);

/** Every field the Review tab lists as still needing input, from the document's own report. */
const needsInput = (pack: Source): readonly GapField[] =>
  completenessReport(pack).sections.flatMap((section) =>
    section.items.map((item) => ({
      path: `${section.id}.${item.target}`,
      label: item.detail === null ? item.label : `${item.label} (${item.detail})`,
      ruleId: GAP_RULE_ID,
    })),
  );

/** The measurement table as points of measure. A tech pack has no grade letters, so the code names the row. */
function poms(measurements: MeasurementsSection): readonly PomState[] {
  const sizes = measurements.columns.map((column) => column.size);
  return measurements.groups.flatMap((group) =>
    group.rows.map((row) => ({
      letter: row.code,
      description: row.label,
      missingSizes: sizes.flatMap((size, index) => (size !== null && !isSet(row.values[index] ?? { status: "to-be-confirmed" }) ? [size] : [])),
      hasTolerance: isSet(row.tolerance),
      needsInput: false,
      ruleId: GAP_RULE_ID,
    })),
  );
}

/** The component list as a bill of materials. A rib is a fabric; everything else keeps its own kind. */
function bom(components: ComponentsSection): readonly BomLine[] {
  const fabrics = components.fabrics.map((fabric): BomLine => ({
    item: value(fabric.name) ?? fabric.fabricId,
    kind: "fabric",
    gaps: [
      value(fabric.composition) === null ? "no composition" : null,
      value(fabric.construction) === null ? "no construction" : null,
      isSet(fabric.weight) ? null : "no weight",
      value(fabric.consumption) === null ? "no consumption" : null,
    ].filter((gap): gap is string => gap !== null),
    ruleId: GAP_RULE_ID,
  }));
  const others = components.others
    .filter((line) => !line.notUsed)
    .map((line): BomLine => ({
      item: value(line.name) ?? line.label,
      kind: line.kind === "rib" ? "fabric" : line.kind,
      gaps: [
        value(line.name) === null ? "no name" : null,
        value(line.details) === null ? "no details" : null,
        value(line.quantity) === null ? "no quantity" : null,
      ].filter((gap): gap is string => gap !== null),
      ruleId: GAP_RULE_ID,
    }));
  return [...fabrics, ...others];
}

/**
 * The colourways as a colour spec. A tech pack holds a colour code and a screen colour per panel, not a
 * Pantone TCX or a swatch id, so those stay null and the checklist names them: a factory needs a swatch, and
 * a hex from a screen is not one.
 */
function colour(colourways: ColourwaysSection, fabricName: string | null, toleranceMax: number | null): ColourState {
  const roles = colourways.colourways.flatMap((block) =>
    block.rows.map((row) => ({
      role: `${block.name}: ${row.label}`,
      hex: value(row.screenColour),
      pantoneTcx: null,
      swatchId: value(row.code),
    })),
  );
  return { fabric: fabricName, roles, toleranceMax, ruleId: GAP_RULE_ID };
}

/**
 * The parts of the document that hold words a person typed. The drawings are left out: a flat is thousands of
 * coordinates and holds no text a factory reads, so walking it would cost time and find nothing.
 */
const tbcSource = (pack: TechPack): unknown => ({
  cover: pack.cover,
  measurements: { groups: pack.measurements.groups },
  components: pack.components,
  construction: { seams: pack.construction.seams },
  colourways: { colourways: pack.colourways.colourways.map((block) => ({ id: block.id, name: block.name, rows: block.rows })) },
  labelling: pack.labelling,
});

export function subjectFromTechPack(pack: TechPack, extras: TechPackSubjectExtras): PreExportSubject {
  const fabricName = pack.components.fabrics.map((fabric) => value(fabric.name)).find((name) => name !== null) ?? null;
  return {
    source: "techpack",
    needsInput: needsInput(pack),
    tbcPaths: tbcPathsOf(tbcSource(pack)),
    poms: poms(pack.measurements),
    sizes: pack.measurements.columns.flatMap((column) => (column.size === null ? [] : [column.size])),
    bom: bom(pack.components),
    colour: colour(pack.colourways, fabricName, extras.colourToleranceMax),
    labels: extras.labels,
    // The document holds no print files: they are an export tab of their own, and the package checks them.
    print: null,
    moderation: { state: extras.moderation, productionClass: extras.productionClass, humanAllowed: extras.humanAllowed },
  };
}
