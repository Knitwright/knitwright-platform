import { describe, expect, it } from "vitest";
import { JSY_BATCH, JSY_INPUT } from "@/lib/kpp/fixtures/jsy-ss-01";
import { checkPackage } from "@/lib/kpp/gate";
import type { KppInput } from "@/lib/kpp/model";
import { preExportCheck } from "./checklist";
import { fixtureLabelInput, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "./fixtures/rows";
import { subjectFromPackage, type PackageSubjectExtras } from "./from-package";
import { destinationLabel } from "./labels";

/**
 * The parity test. `lib/kpp/gate.ts` holds the production package's own copy of the F-G2 checks, written
 * before this one existed; the package is X5b's file and not Z8's to change. So this proves, over the worked
 * article and one mutation per check, that the one checklist refuses exactly what that gate refuses. Whoever
 * deletes the copy can read this file first.
 *
 * Parity is on the decision, not the prose: both say "this may not be built" for the same reason. The
 * sentences differ on purpose, because the one checklist reads a market's rows and the package's gate reads
 * already-flattened text, and the first can say more.
 */

const written = () => [destinationLabel(fixtureLabelInput()), destinationLabel(fixtureLabelInput({ country: "AU", countryName: "Australia" }))];

const extras = (over: Partial<PackageSubjectExtras> = {}): PackageSubjectExtras => ({
  labels: written(),
  productionClass: "A",
  humanAllowed: null,
  ...over,
});

const checked = (input: KppInput, over: Partial<PackageSubjectExtras> = {}) => preExportCheck(subjectFromPackage(input, extras(over)));

const MUTATIONS: readonly (readonly [string, (input: KppInput) => KppInput])[] = [
  ["a field that still needs input", (i) => ({ ...i, fields: [...i.fields, { id: "season", label: "Season", value: null, provenance: "needs_input", ruleId: "R-GAP-000" }] })],
  ["a field left empty", (i) => ({ ...i, fields: i.fields.map((f, n) => (n === 0 ? { ...f, value: "  " } : f)) })],
  ["[TBC] in a bill-of-materials line", (i) => ({ ...i, bom: i.bom.map((row, n) => (n === 0 ? { ...row, spec: "Fabric [TBC]" } : row)) })],
  ["no points of measure", (i) => ({ ...i, poms: [] })],
  ["a point of measure with no value for a size", (i) => ({ ...i, poms: i.poms.map((p, n) => (n === 0 ? { ...p, values: { ...p.values, M: null } } : p)) })],
  ["a point of measure with no tolerance", (i) => ({ ...i, poms: i.poms.map((p, n) => (n === 0 ? { ...p, tolPlusMm: null } : p)) })],
  ["no bill of materials", (i) => ({ ...i, bom: [] })],
  ["a bill of materials with no fabric line", (i) => ({ ...i, bom: i.bom.filter((row) => row.type !== "fabric") })],
  ["a bill-of-materials line with no quantity", (i) => ({ ...i, bom: i.bom.map((row, n) => (n === 0 ? { ...row, qtyPerPiece: null } : row)) })],
  ["no fabric on the colour spec", (i) => ({ ...i, colour: { ...i.colour, fabric: null } })],
  ["no agreed colour difference", (i) => ({ ...i, colour: { ...i.colour, tolerance: { metric: "dE_CMC_2_1", max: null } } })],
  ["a colour with no swatch", (i) => ({ ...i, colour: { ...i.colour, colours: i.colour.colours.map((c) => ({ ...c, swatchId: null })) } })],
  ["print files below the DPI the rules ask for", (i) => ({ ...i, print: { ...i.print, dpi: 96 } })],
  ["print files below the bleed the rules ask for", (i) => ({ ...i, print: { ...i.print, bleedMm: 2 } })],
  ["a flagged design", (i) => ({ ...i, moderation: "flagged" })],
  ["a design whose moderation check has not finished", (i) => ({ ...i, moderation: "pending" })],
];

describe("the one checklist against the production package's own gate", () => {
  it("both pass the worked article, sample and batch", () => {
    expect(checkPackage(JSY_INPUT)).toEqual([]);
    expect(checked(JSY_INPUT).clear).toBe(true);
    expect(checkPackage(JSY_BATCH)).toEqual([]);
    expect(checked(JSY_BATCH).clear).toBe(true);
  });

  it.each(MUTATIONS)("both refuse %s", (_name, mutate) => {
    const input = mutate(JSY_INPUT);
    expect(checkPackage(input).length).toBeGreaterThan(0);
    const result = checked(input);
    expect(result.clear).toBe(false);
    expect(result.blockers.length).toBeGreaterThan(0);
  });

  it("both refuse a batch with no orders, and a size that is not in the size run", () => {
    expect(checkPackage({ ...JSY_BATCH, orders: [] }).length).toBeGreaterThan(0);
    expect(checked({ ...JSY_BATCH, orders: [] }).clear).toBe(false);
    const strange = { ...JSY_BATCH, orders: [{ orderNo: "KW10999", sizes: { ZZ: 1 }, dueDate: null }] };
    expect(checkPackage(strange).length).toBeGreaterThan(0);
    expect(checked(strange).clear).toBe(false);
  });

  it("both carry the gamut estimate as a note rather than a refusal", () => {
    const loud = { ...JSY_INPUT, colour: { ...JSY_INPUT.colour, colours: [{ role: "primary", hex: "#FF0000", pantoneTcx: "19-1664 TCX", swatchId: "SB-2" }] } };
    expect(checkPackage(loud)).toEqual([]);
    const result = checked(loud);
    expect(result.clear).toBe(true);
    expect(result.warnings.map((found) => found.code)).toEqual(["colour_outside_gamut"]);
  });

  it("is stricter than the package's gate about labels, because it reads the market's rows", () => {
    // The package's gate reads already-flattened text and is satisfied; the one checklist reads the rows and
    // finds the care symbols and the size wording nobody has written.
    expect(checkPackage(JSY_INPUT)).toEqual([]);
    const result = checked(JSY_INPUT, { labels: [destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }))] });
    expect(result.clear).toBe(false);
    expect(result.blockers.map((found) => found.code)).toContain("care_symbols_missing");
  });
});

describe("what the adapter reads out of a package input", () => {
  it("keeps each point of measure's own rule id and the sizes it has no value for", () => {
    const subject = subjectFromPackage({ ...JSY_INPUT, poms: JSY_INPUT.poms.map((p, n) => (n === 0 ? { ...p, values: { ...p.values, M: null, L: null } } : p)) }, extras());
    expect(subject.poms[0]).toMatchObject({ letter: "A", ruleId: "R-FIT-001", missingSizes: ["M", "L"], hasTolerance: true });
  });

  it("uses the same words for a bill-of-materials gap as the package's gate, so the two can be compared", () => {
    const subject = subjectFromPackage({ ...JSY_INPUT, bom: JSY_INPUT.bom.map((row, n) => (n === 0 ? { ...row, unit: null, qtyPerPiece: null } : row)) }, extras());
    expect(subject.bom[0]?.gaps).toEqual(["no quantity", "no unit"]);
  });

  it("marks a sample package as needing no human review, and a Class B one as needing it", () => {
    expect(subjectFromPackage(JSY_INPUT, extras()).moderation).toEqual({ state: "clear", productionClass: "A", humanAllowed: null });
    expect(checked(JSY_INPUT, { productionClass: "B" }).clear).toBe(false);
    expect(checked(JSY_INPUT, { productionClass: "B", humanAllowed: true }).clear).toBe(true);
  });

  it("names the package as its source, and carries the print rules through", () => {
    const subject = subjectFromPackage(JSY_INPUT, extras());
    expect(subject.source).toBe("package");
    expect(subject.print).toEqual({ dpi: 150, minDpi: 150, bleedMm: 10, minBleedMm: 10, ruleId: "R-SUB-002" });
    expect(subject.sizes).toEqual(JSY_INPUT.design.sizes);
  });

  it("finds [TBC] wherever it is, with its path", () => {
    const subject = subjectFromPackage({ ...JSY_INPUT, notes: ["Something [tbc] here"] }, extras());
    expect(subject.tbcPaths).toEqual(["notes[0]"]);
  });
});
