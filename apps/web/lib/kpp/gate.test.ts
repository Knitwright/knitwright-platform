import { describe, expect, it } from "vitest";
import { JSY_BATCH, JSY_INPUT } from "./fixtures/jsy-ss-01";
import { checkPackage, packageWarnings } from "./gate";
import type { KppInput } from "./model";

/** The F-G2 pre-export check: every reason a package may not be built, listed in words. */

const messages = (input: KppInput): string[] => checkPackage(input).map((i) => i.message);
const paths = (input: KppInput): string[] => checkPackage(input).map((i) => i.path);

describe("checkPackage: a complete package", () => {
  it("has nothing to say about the worked example", () => {
    expect(checkPackage(JSY_INPUT)).toEqual([]);
    expect(checkPackage(JSY_BATCH)).toEqual([]);
  });

  it("gives the same list in the same order twice", () => {
    const broken: KppInput = { ...JSY_INPUT, poms: [], bom: [], labels: [] };
    expect(checkPackage(broken)).toEqual(checkPackage(broken));
  });

  it("carries a rule id on every issue", () => {
    const broken: KppInput = { ...JSY_INPUT, poms: [], bom: [], labels: [], colour: { ...JSY_INPUT.colour, fabric: null, colours: [] } };
    expect(checkPackage(broken).every((i) => /^R-[A-Z]+-[0-9]{3}$/.test(i.ruleId))).toBe(true);
  });
});

describe("checkPackage: fields and [TBC]", () => {
  it("names each field that still needs input", () => {
    const input: KppInput = {
      ...JSY_INPUT,
      fields: [
        { id: "season", label: "Season", value: null, provenance: "needs_input", ruleId: "R-GAP-000" },
        { id: "factory", label: "Factory", value: "   ", provenance: "from_base", ruleId: "R-GAP-000" },
      ],
    };
    expect(messages(input)).toEqual(["Season: needs your input.", "Factory: needs your input."]);
  });

  it("refuses [TBC] wherever it hides, and says where", () => {
    const input: KppInput = { ...JSY_INPUT, qc: { ...JSY_INPUT.qc, photos: ["Front", "Label [TBC]"] } };
    const issues = checkPackage(input);
    expect(issues).toHaveLength(1);
    expect(issues[0].path).toBe("qc.photos[1]");
    expect(issues[0].message).toContain("holds [TBC]");
  });

  it("finds [tbc] in any letter case", () => {
    expect(messages({ ...JSY_INPUT, dueDate: "[tbc]" })).toEqual(["dueDate: holds [TBC], which a package may not contain."]);
  });
});

describe("checkPackage: measurements, materials, colour and labels", () => {
  it("refuses no points of measure at all", () => {
    expect(messages({ ...JSY_INPUT, poms: [] })).toContain("Points of measure: none are listed.");
  });

  it("names a size with no value and a POM with no tolerance", () => {
    const [first, ...rest] = JSY_INPUT.poms;
    const input: KppInput = {
      ...JSY_INPUT,
      poms: [{ ...first, values: { ...first.values, "3XL": null }, tolPlusMm: null }, ...rest],
    };
    expect(messages(input)).toEqual([
      "POM A Chest width, 25 mm below armhole, half: no value for 3XL.",
      "POM A Chest width, 25 mm below armhole, half: no tolerance.",
    ]);
  });

  it("refuses a bill of materials with no lines and one with no fabric", () => {
    expect(messages({ ...JSY_INPUT, bom: [] })).toContain("Bill of materials: no lines.");
    expect(messages({ ...JSY_INPUT, bom: JSY_INPUT.bom.filter((b) => b.type !== "fabric") })).toContain("Bill of materials: no fabric line.");
  });

  it("lists every gap in one BOM line together", () => {
    const [fabric, ...rest] = JSY_INPUT.bom;
    const input: KppInput = { ...JSY_INPUT, bom: [fabric, { ...rest[0], spec: null, qtyPerPiece: null, unit: " " }] };
    expect(messages(input)).toEqual(["BOM Needle thread: no specification, no quantity, no unit."]);
  });

  it("refuses a colour with no hex, Pantone or swatch, and a spec with no fabric", () => {
    const input: KppInput = {
      ...JSY_INPUT,
      colour: { ...JSY_INPUT.colour, fabric: null, colours: [{ role: "primary", hex: "navy", pantoneTcx: null, swatchId: null }] },
    };
    expect(messages(input)).toEqual([
      "Colour spec: no fabric named.",
      "Colour primary: no valid hex, no Pantone TCX, no swatch ID.",
    ]);
  });

  it("refuses no colour roles at all", () => {
    expect(messages({ ...JSY_INPUT, colour: { ...JSY_INPUT.colour, colours: [] } })).toEqual(["Colour spec: no colour roles."]);
  });

  it("refuses no destination market, and names what a label is missing", () => {
    expect(messages({ ...JSY_INPUT, labels: [] })).toContain("Care labels: no destination market.");
    const input: KppInput = { ...JSY_INPUT, labels: [{ ...JSY_INPUT.labels[0], fibre: null, care: [], origin: null, size: null, importer: null }] };
    expect(messages(input)).toEqual(["Care label UK: missing fibre content, care, origin, size, importer."]);
  });

  it("does not ask for an importer in a market that needs none", () => {
    const input: KppInput = { ...JSY_INPUT, labels: [{ ...JSY_INPUT.labels[1], importer: null }] };
    expect(messages(input)).toEqual([]);
  });
});

describe("checkPackage: print, batch and moderation", () => {
  it("refuses print files below the rules' DPI or bleed", () => {
    const input: KppInput = { ...JSY_INPUT, print: { ...JSY_INPUT.print, dpi: 96, bleedMm: 3 } };
    expect(messages(input)).toEqual([
      "Print files: 96 DPI is below the 150 DPI the rules ask for.",
      "Print files: 3 mm bleed is below the 10 mm the rules ask for.",
    ]);
    expect(paths(input)).toEqual(["print.dpi", "print.bleedMm"]);
  });

  it("refuses a batch with no orders, and an order for a size outside the run", () => {
    expect(messages({ ...JSY_BATCH, orders: [] })).toContain("Batch: no orders.");
    const input: KppInput = { ...JSY_BATCH, orders: [{ orderNo: "KW1", sizes: { "4XL": 1 }, dueDate: null }] };
    expect(messages(input)).toContain("Order KW1: size 4XL is not in the size run.");
  });

  it("ignores orders on a sample package", () => {
    expect(checkPackage({ ...JSY_INPUT, orders: [{ orderNo: "KW1", sizes: { "4XL": 1 }, dueDate: null }] })).toEqual([]);
  });

  it("refuses a flagged or pending moderation check, and allows a clear one", () => {
    expect(messages({ ...JSY_INPUT, moderation: "flagged" })).toEqual(["Moderation: the design is flagged and must be cleared first."]);
    expect(messages({ ...JSY_INPUT, moderation: "pending" })).toEqual(["Moderation: the check has not finished."]);
    expect(messages({ ...JSY_INPUT, moderation: "clear" })).toEqual([]);
  });

  it("lets a package through while no moderation check exists, and warns instead", () => {
    const input: KppInput = { ...JSY_INPUT, moderation: "not_built" };
    expect(checkPackage(input)).toEqual([]);
    expect(packageWarnings(input)).toContain("The design has not been through a moderation check: none exists yet.");
  });
});

describe("packageWarnings", () => {
  it("says nothing about a colour inside the estimated gamut", () => {
    expect(packageWarnings(JSY_INPUT)).toEqual([]);
  });

  it("warns about a very saturated colour without stopping the package", () => {
    const input: KppInput = { ...JSY_INPUT, colour: { ...JSY_INPUT.colour, colours: [{ ...JSY_INPUT.colour.colours[0], hex: "#00FF00" }] } };
    expect(checkPackage(input)).toEqual([]);
    const warnings = packageWarnings(input);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("may print duller on fabric");
    expect(warnings[0]).toContain("match the strike-off");
  });
});
