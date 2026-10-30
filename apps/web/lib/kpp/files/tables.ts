import { csv, hexToLab, stableJson } from "../encode";
import type { KppInput } from "../model";

/** The machine-readable files of the package: CSV and JSON, laid out as docs/spec/04 shows. */

export function pomCsv(input: KppInput): string {
  const { sizes, articleCode, baseSize } = input.design;
  const header = ["article", "pom_letter", "pom_code", "description", "grade_type", "grade_mm", "tol_minus_mm", "tol_plus_mm", "base_size", ...sizes];
  const rows = input.poms.map((p) => [articleCode, p.letter, p.code, p.description, p.gradeType, p.gradeMm, p.tolMinusMm, p.tolPlusMm, baseSize, ...sizes.map((s) => p.values[s] ?? null)]);
  return csv([header, ...rows]);
}

export function bomCsv(input: KppInput): string {
  const header = ["item", "type", "spec", "supplier_ref", "qty_per_piece", "unit", "size_dependent"];
  return csv([header, ...input.bom.map((b) => [b.item, b.type, b.spec, b.supplierRef, b.qtyPerPiece, b.unit, b.sizeDependent])]);
}

const NAME_COLUMNS = ["order_no", "line_id", "size", "name", "number", "name_zone", "number_zone", "font_id", "colour_hex"];

/**
 * One line per garment to personalise, ordered by order, then line, then the rest of the row.
 * The order is total — two rows the same down to the last column sort the same way — so the file
 * does not change when the rows are read in another order.
 */
export function namesCsv(input: KppInput): string {
  const cells = input.personalisation.map((r) => [r.orderNo, r.lineId, r.size, r.name, r.number, r.nameZone, r.numberZone, r.fontId, r.colourHex]);
  const key = (row: readonly string[]): string => row.join("\u0000");
  const rows = [...cells].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  return csv([NAME_COLUMNS, ...rows]);
}

const versionLabel = (input: KppInput): string => `${input.design.code} v${input.design.version}`;

/**
 * What the Lab numbers in this file are in (owner decision 15 of plan v5). The colour house needs the space and
 * the observer to read a delta E against them: `docs/spec/04`'s own example for `#0B1F4B` is not what this maths
 * gives, the spec calls its numbers illustrative, and ours is the one the platform can reproduce and test.
 */
export const LAB_SPACE = "sRGB, D65 white point, two-degree observer. Computed from the screen colour, not measured.";

export function colourJson(input: KppInput): string {
  const c = input.colour;
  return stableJson({
    design_version: versionLabel(input),
    fabric: c.fabric,
    lab_space: LAB_SPACE,
    tolerance: c.tolerance,
    colours: c.colours.map((k) => ({ role: k.role, hex: k.hex, lab: k.hex === null ? null : hexToLab(k.hex), pantone_tcx: k.pantoneTcx, swatch_id: k.swatchId })),
    strike_off_required: c.strikeOffRequired,
    rule_id: c.ruleId,
  });
}

/** The tech pack's content as JSON, with provenance and rule ids, so a factory or PLM can import it. */
export function techpackJson(input: KppInput): string {
  const d = input.design;
  return stableJson({
    schema: "knitwright.kpp.techpack/1",
    design: { code: d.code, name: d.name, article: d.articleCode, version: d.version, hash: d.hash, brand: d.brand, season: d.season, base_size: d.baseSize, sizes: d.sizes },
    factory: { code: input.factory.code, name: input.factory.name },
    overview: input.fields.map((f) => ({ id: f.id, label: f.label, value: f.value, provenance: f.provenance, rule_id: f.ruleId })),
    measurements: input.poms.map((p) => ({
      letter: p.letter,
      code: p.code,
      description: p.description,
      grade_type: p.gradeType,
      grade_mm: p.gradeMm,
      tol_minus_mm: p.tolMinusMm,
      tol_plus_mm: p.tolPlusMm,
      values_mm: d.sizes.map((s) => ({ size: s, value: p.values[s] ?? null })),
      provenance: p.provenance,
      rule_id: p.ruleId,
    })),
    bom: input.bom.map((b) => ({ item: b.item, type: b.type, spec: b.spec, supplier_ref: b.supplierRef, qty_per_piece: b.qtyPerPiece, unit: b.unit, size_dependent: b.sizeDependent, provenance: b.provenance, rule_id: b.ruleId })),
    colourways: JSON.parse(colourJson(input)),
    labels: input.labels.map((l) => ({ market: l.market, fibre: l.fibre, care: l.care, origin: l.origin, size: l.size, importer: l.importer, rule_id: l.ruleId })),
    qc: { aql_plan: input.qc.aqlPlan, measure: input.qc.measure, colour: input.qc.colour, visual: input.qc.visual, photos: input.qc.photos, rule_id: input.qc.ruleId },
    print: { dpi: input.print.dpi, bleed_mm: input.print.bleedMm, mirrored: false, rule_id: input.print.ruleId },
  });
}
