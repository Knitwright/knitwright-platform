import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { completenessReport } from "@/lib/techpack/completeness";
import { fullDesign, packFor, PROJECT } from "@/lib/techpack/fixtures/designs";
import { preExportCheck } from "./checklist";
import { fixtureLabelInput, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "./fixtures/rows";
import { subjectFromTechPack, type TechPackSubjectExtras } from "./from-techpack";
import { destinationLabel } from "./labels";

/**
 * The tech pack Review tab (`docs/spec/02-features.md`: "Every field still 'Needs your input', plus the F-G2
 * pre-export check"). Two packs are used: a design nobody has filled in, and `fullDesign`, which the tech
 * pack's own tests use as a filled-in one.
 */

const extras = (over: Partial<TechPackSubjectExtras> = {}): TechPackSubjectExtras => ({
  labels: [destinationLabel(fixtureLabelInput())],
  moderation: "clear",
  productionClass: "A",
  humanAllowed: null,
  colourToleranceMax: 1.5,
  ...over,
});

const emptyPack = () => packFor(start("crew-tee"), { project: { ...PROJECT, styleNumber: "", season: "" } });
const fullPack = () => packFor(fullDesign("crew-tee"));

describe("the Review tab over a design nobody has filled in", () => {
  const pack = emptyPack();
  const result = preExportCheck(subjectFromTechPack(pack, extras()));

  it("refuses the export, as the spec says it must", () => {
    expect(result.clear).toBe(false);
  });

  it("lists exactly the fields the document's own report calls empty", () => {
    const expected = completenessReport(pack).sections.flatMap((section) => section.items.length);
    const total = expected.reduce((sum, one) => sum + one, 0);
    expect(subjectFromTechPack(pack, extras()).needsInput).toHaveLength(total);
    expect(total).toBeGreaterThan(0);
  });

  it("carries R-GAP-000 on every gap read out of the document, because a cell holds no rule id", () => {
    expect(subjectFromTechPack(pack, extras()).needsInput.every((gap) => gap.ruleId === "R-GAP-000")).toBe(true);
  });

  it("does not check print files: a tech pack holds none", () => {
    expect(subjectFromTechPack(pack, extras()).print).toBeNull();
    expect(result.items.filter((item) => item.skipped === "not_in_this_source").map((item) => item.id)).toEqual(["dpi", "bleed"]);
  });
});

describe("the Review tab over a filled-in design", () => {
  const pack = fullPack();
  const subject = subjectFromTechPack(pack, extras());

  it("still names what a factory needs and a tech pack does not hold: a Pantone code and a swatch", () => {
    const result = preExportCheck(subject);
    expect(result.blockers.map((found) => found.code)).toContain("colour_incomplete");
    expect(result.blockers.find((found) => found.code === "colour_incomplete")?.message).toContain("no Pantone TCX");
  });

  it("reads the measurement table as points of measure, with the row's code as its letter", () => {
    expect(subject.poms.length).toBeGreaterThan(0);
    expect(subject.poms.every((pom) => pom.letter.length > 0 && pom.description.length > 0)).toBe(true);
  });

  it("reads the component list as a bill of materials, with a rib counted as a fabric", () => {
    expect(subject.bom.some((row) => row.kind === "fabric")).toBe(true);
    expect(subject.bom.every((row) => row.item.trim() !== "")).toBe(true);
  });

  it("takes the size run from the table's own columns", () => {
    expect(subject.sizes.length).toBeGreaterThan(0);
    expect(subject.sizes).toEqual(pack.measurements.columns.flatMap((column) => (column.size === null ? [] : [column.size])));
  });

  it("names the tech pack as its source", () => {
    expect(subject.source).toBe("techpack");
  });
});

describe("[TBC] in the document", () => {
  it("is found in a field a person typed", () => {
    const pack = packFor(start("crew-tee"), { project: { ...PROJECT, styleNumber: "ACME-[TBC]" } });
    expect(subjectFromTechPack(pack, extras()).tbcPaths).toContain("cover.styleNumber.value");
  });

  it("is not looked for in a drawing, which holds coordinates and no words", () => {
    const subject = subjectFromTechPack(fullPack(), extras());
    expect(subject.tbcPaths.some((path) => path.includes("drawing"))).toBe(false);
  });
});

describe("what the Review tab shows about labels and review", () => {
  it("shows the market's own gaps, not the document's", () => {
    const result = preExportCheck(
      subjectFromTechPack(fullPack(), extras({ labels: [destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }))] })),
    );
    expect(result.blockers.map((found) => found.code)).toContain("care_symbols_missing");
  });

  it("shows a Class B design's human review before anyone presses anything", () => {
    const result = preExportCheck(subjectFromTechPack(fullPack(), extras({ productionClass: "B" })));
    expect(result.blockers.map((found) => found.code)).toContain("class_b_human_review_required");
  });
});
