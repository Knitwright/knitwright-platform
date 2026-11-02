import { describe, expect, it } from "vitest";
import { start } from "@/lib/garment/fixtures/specs";
import { destinationLabel } from "@/lib/compliance/labels";
import {
  fixtureFabric,
  fixtureLabelInput,
  SEEDED_CARE_SYMBOLS,
  SEEDED_LABEL_RULES_GB,
  SEEDED_LABEL_RULES_US,
} from "@/lib/compliance/fixtures/rows";
import { destinationLabelSection, destinationLabelSections, LABEL_ROW_TITLES, panelLabelOf, usableLabelCount } from "./labels";

/**
 * The "Labels & packaging" tab, per destination market (plan v5 Z8, decision 0089). `panelLabelOf` is this
 * file's older export and `edge-cases.test.ts` covers it; one line here keeps it from being broken by a
 * refactor of the rest.
 */

describe("panelLabelOf still works", () => {
  it("names a panel, and falls back to the panel id", () => {
    expect(panelLabelOf(start("crew-tee"), "body-front")).toBe("Body front");
    expect(panelLabelOf(start("crew-tee"), "wing")).toBe("wing");
  });
});

describe("the tab over the seeded United Kingdom row", () => {
  const section = destinationLabelSection(destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS })));

  it("shows a row for every line, so a reader sees what is missing rather than its absence", () => {
    expect(section.rows.map((row) => row.kind)).toEqual(["fibre", "care", "origin", "size", "importer", "certification"]);
    expect(section.rows.map((row) => row.label)).toEqual(Object.values(LABEL_ROW_TITLES));
  });

  it("fills nothing in, because the label may not be used", () => {
    expect(section.usable).toBe(false);
    expect(section.rows.every((row) => row.value === null && row.source === null)).toBe(true);
  });

  it("says in one sentence why it may not be used", () => {
    expect(section.note).toContain("No care symbols are chosen");
  });

  it("carries the rule that asks for each missing line, so the tab can show a reason", () => {
    expect(section.rows.find((row) => row.kind === "care")?.ruleId).toBe("R-LAB-002");
    expect(section.rows.find((row) => row.kind === "importer")?.ruleId).toBe("R-GAP-000");
  });

  it("carries the market row's own provenance label", () => {
    expect(section.label).toContain("not reviewed by a factory");
  });
});

describe("the tab over a market whose wording is written", () => {
  const section = destinationLabelSection(destinationLabel(fixtureLabelInput({ fabric: fixtureFabric({ oekoTexCert: "20.HPK.12345" }) })));

  it("fills in every line the market states, each with its source", () => {
    const filled = section.rows.filter((row) => row.value !== null);
    expect(filled.map((row) => row.kind)).toEqual(["fibre", "care", "origin", "size", "certification"]);
    expect(filled.every((row) => (row.source ?? "").trim() !== "")).toBe(true);
  });

  it("leaves the importer empty where the market does not require one, and says nothing against it", () => {
    expect(section.rows.find((row) => row.kind === "importer")?.value).toBeNull();
    expect(section.note).toBeNull();
    expect(section.usable).toBe(true);
  });

  it("names the market, so a tab can head the section with it", () => {
    expect(section.title).toBe("United Kingdom");
    expect(section.country).toBe("GB");
  });
});

describe("every market at once", () => {
  const labels = [
    destinationLabel(fixtureLabelInput()),
    destinationLabel(fixtureLabelInput({ country: "US", countryName: "United States", sellingEnabled: false, labelRules: SEEDED_LABEL_RULES_US, careSymbols: SEEDED_CARE_SYMBOLS })),
  ];

  it("keeps the order the markets were asked for", () => {
    expect(destinationLabelSections(labels).map((section) => section.country)).toEqual(["GB", "US"]);
  });

  it("counts the markets a design may actually be labelled for", () => {
    expect(usableLabelCount(labels)).toBe(1);
    expect(usableLabelCount([])).toBe(0);
  });

  it("says of the United States that the market is closed and CPSIA testing does not exist", () => {
    const note = destinationLabelSections(labels)[1]?.note ?? "";
    expect(note).toContain("not a market Knitwright sells into yet");
    expect(note).toContain("CPSIA testing");
  });
});
