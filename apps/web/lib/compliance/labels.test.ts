import { describe, expect, it } from "vitest";
import {
  SEEDED_CARE_SYMBOLS,
  SEEDED_LABEL_RULES_GB,
  SEEDED_LABEL_RULES_US,
  fixtureFabric,
  fixtureLabelInput,
  writtenCareSymbol,
  writtenLabelRules,
} from "./fixtures/rows";
import { destinationLabel, destinationLabels, printableLines } from "./labels";

const codesOf = (label: ReturnType<typeof destinationLabel>): readonly string[] => label.findings.map((found) => found.code);

describe("the label the seeded rows give today", () => {
  const label = destinationLabel(
    fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }),
  );

  it("may not be used, because the care symbols, the size wording and the importer requirement are not written", () => {
    expect(label.usable).toBe(false);
    expect(codesOf(label)).toEqual(["cpsia_not_recorded", "care_symbols_missing", "size_wording_missing", "importer_requirement_unknown"]);
  });

  it("does print the fibre content, because the fabric row states the blend and the market states the order", () => {
    expect(label.lines.map((line) => line.kind)).toEqual(["fibre", "origin"]);
    expect(label.lines[0]).toMatchObject({ text: "100% polyester", source: "programme_fabrics.blend for F-POLY-INT" });
  });

  it("names the rulebook entry that asks for each missing line", () => {
    expect(label.findings.filter((found) => found.ruleId === "R-LAB-002").map((found) => found.code)).toEqual([
      "care_symbols_missing",
      "size_wording_missing",
    ]);
    // Nobody has taken a position on whether a market needs an importer address, so no entry explains it.
    expect(label.findings.find((found) => found.code === "importer_requirement_unknown")?.ruleId).toBe("R-GAP-000");
  });

  it("carries the market row's own provenance label", () => {
    expect(label.label).toContain("not reviewed by a factory");
  });

  it("hands a factory nothing, because a label missing its care and size lines is not a label", () => {
    expect(printableLines(label)).toEqual([]);
  });
});

/**
 * The one test the orchestrator asked for by name: nothing unsourced reaches a label a factory would read.
 * It is stated over every label this file can build, not only over the seeded one.
 */
describe("nothing unsourced reaches a label", () => {
  const cases = [
    ["the seeded United Kingdom row", fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS })],
    ["the seeded United States row", fixtureLabelInput({ country: "US", countryName: "United States", sellingEnabled: false, labelRules: SEEDED_LABEL_RULES_US, careSymbols: SEEDED_CARE_SYMBOLS })],
    ["an empty label_rules column", fixtureLabelInput({ labelRules: {}, careSymbols: [] })],
    ["a market whose wording is written", fixtureLabelInput()],
    ["a fabric with a certificate", fixtureLabelInput({ fabric: fixtureFabric({ oekoTexCert: "20.HPK.12345" }) })],
    ["a care symbol with words but no source", fixtureLabelInput({ careSymbols: [writtenCareSymbol({ source: null })] })],
    ["a care symbol with a source but no words", fixtureLabelInput({ careSymbols: [writtenCareSymbol({ words: null })] })],
    ["a fibre line written by the market", fixtureLabelInput({ labelRules: writtenLabelRules() })],
  ] as const;

  it.each(cases)("%s prints no line without a source", (_name, input) => {
    const label = destinationLabel(input);
    for (const line of label.lines) {
      expect(line.source.trim()).not.toBe("");
      expect(line.text.trim()).not.toBe("");
    }
    for (const line of printableLines(label)) expect(line.source.trim()).not.toBe("");
  });
});

describe("the fibre line", () => {
  it("takes the market's own wording where it has one", () => {
    const label = destinationLabel(fixtureLabelInput());
    expect(label.lines.find((line) => line.kind === "fibre")).toMatchObject({ text: "100% Polyester", source: "The market's own wording" });
  });

  it("falls back to the fabric row's blend, and says which row it came from", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), fibre: { text: null, language: "en", order: "descending_percentage", confirmed: false, source: null } },
    });
    const line = destinationLabel(fixtureLabelInput({ labelRules: rules })).lines.find((one) => one.kind === "fibre");
    expect(line).toMatchObject({ text: "100% polyester", source: "programme_fabrics.blend for F-POLY-INT" });
  });

  it("refuses when nobody has written the language and the order the market needs", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), fibre: { text: "100% Polyester", language: null, order: null, confirmed: true, source: "Somewhere" } },
    });
    const label = destinationLabel(fixtureLabelInput({ labelRules: rules }));
    expect(codesOf(label)).toContain("fibre_order_unknown");
    expect(label.lines.some((line) => line.kind === "fibre")).toBe(false);
  });

  it("refuses when neither the market nor the fabric states the fibre content", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), fibre: { text: null, language: "en", order: "descending_percentage", confirmed: false, source: null } },
    });
    expect(codesOf(destinationLabel(fixtureLabelInput({ labelRules: rules, fabric: fixtureFabric({ blend: null }) })))).toContain("fibre_missing");
  });
});

describe("the care line", () => {
  it("prints the symbol reference and its words, and names both halves of the source", () => {
    const line = destinationLabel(fixtureLabelInput()).lines.find((one) => one.kind === "care");
    expect(line?.text).toBe("Figure 1 Machine wash at 30 degrees");
    // Why these symbols, and where each one's words came from.
    expect(line?.source).toBe("The market's own wording; A licensed copy of ISO 3758:2012, transcribed by the owner");
  });

  it("refuses symbols nothing says the market needs, however well sourced each one is", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), care: { symbolCodes: ["ISO3758-WASHING"], confirmed: true, source: null } },
    });
    const label = destinationLabel(fixtureLabelInput({ labelRules: rules }));
    expect(codesOf(label)).toContain("care_choice_unsourced");
    expect(label.findings.find((found) => found.code === "care_choice_unsourced")?.message).toContain("why these care symbols");
    expect(label.lines.some((line) => line.kind === "care")).toBe(false);
  });

  it("refuses a symbol code that no row answers", () => {
    const label = destinationLabel(fixtureLabelInput({ careSymbols: [] }));
    expect(codesOf(label)).toContain("care_symbol_unsourced");
    expect(label.findings.find((found) => found.code === "care_symbol_unsourced")?.message).toContain("ISO3758-WASHING");
  });

  it("refuses a symbol whose row has no symbol reference", () => {
    expect(codesOf(destinationLabel(fixtureLabelInput({ careSymbols: [writtenCareSymbol({ symbolRef: null })] })))).toContain("care_symbol_unsourced");
  });

  it("is confirmed only when the market's wording and every symbol are confirmed", () => {
    const line = destinationLabel(fixtureLabelInput({ careSymbols: [writtenCareSymbol({ confirmed: false })] })).lines.find((one) => one.kind === "care");
    expect(line?.confirmed).toBe(false);
  });
});

describe("the origin, size and importer lines", () => {
  it("prints the origin with the file it came from", () => {
    expect(destinationLabel(fixtureLabelInput()).lines.find((line) => line.kind === "origin")).toMatchObject({
      text: "Made in Pakistan",
      source: "docs/spec/04-production-package.md, section 07_labels",
    });
  });

  it("refuses a garment with no size run", () => {
    expect(codesOf(destinationLabel(fixtureLabelInput({ sizes: [] })))).toContain("size_run_missing");
  });

  it("leaves the importer off a market that does not require one", () => {
    expect(destinationLabel(fixtureLabelInput()).lines.some((line) => line.kind === "importer")).toBe(false);
  });

  it("takes the brand's own importer details where the market requires an address", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), importer: { text: null, required: true, confirmed: false, source: null } },
    });
    const line = destinationLabel(fixtureLabelInput({ labelRules: rules, importer: "Acme FC, 1 Example Street, London" })).lines.find((one) => one.kind === "importer");
    expect(line).toMatchObject({ text: "Acme FC, 1 Example Street, London", source: "The brand's own importer details" });
  });

  it("refuses where the market requires an address and nobody gave one", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), importer: { text: null, required: true, confirmed: false, source: null } },
    });
    expect(codesOf(destinationLabel(fixtureLabelInput({ labelRules: rules })))).toContain("importer_missing");
  });

  it("takes the market's own importer wording where the row holds one", () => {
    const rules = writtenLabelRules({
      lines: { ...(writtenLabelRules().lines as object), importer: { text: "Imported by Acme BV", required: true, confirmed: true, source: "The market's own wording" } },
    });
    expect(destinationLabel(fixtureLabelInput({ labelRules: rules })).lines.find((one) => one.kind === "importer")?.text).toBe("Imported by Acme BV");
  });
});

describe("the OEKO-TEX line", () => {
  it("appears only where that fabric holds a certificate", () => {
    expect(destinationLabel(fixtureLabelInput()).lines.some((line) => line.kind === "certification")).toBe(false);
    const line = destinationLabel(fixtureLabelInput({ fabric: fixtureFabric({ oekoTexCert: "20.HPK.12345" }) })).lines.find((one) => one.kind === "certification");
    expect(line).toMatchObject({ text: "OEKO-TEX Standard 100, 20.HPK.12345", source: "programme_fabrics.oeko_tex_cert for F-POLY-INT" });
  });
});

describe("a whole written label", () => {
  it("is usable, and prints fibre, care, origin and size in label order", () => {
    const label = destinationLabel(fixtureLabelInput());
    expect(label.usable).toBe(true);
    expect(label.lines.map((line) => line.kind)).toEqual(["fibre", "care", "origin", "size"]);
    expect(printableLines(label)).toHaveLength(4);
  });

  it("is refused when the market is closed, however complete the wording", () => {
    const label = destinationLabel(fixtureLabelInput({ sellingEnabled: false }));
    expect(label.usable).toBe(false);
    expect(printableLines(label)).toEqual([]);
  });

  it("is built for every market asked for, in the order asked for", () => {
    const labels = destinationLabels([fixtureLabelInput(), fixtureLabelInput({ country: "AU", countryName: "Australia" })]);
    expect(labels.map((one) => one.country)).toEqual(["GB", "AU"]);
  });

  it("is the same label every time, for the same rows", () => {
    expect(destinationLabel(fixtureLabelInput())).toEqual(destinationLabel(fixtureLabelInput()));
  });
});
