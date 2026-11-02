import { describe, expect, it } from "vitest";
import { CARD_KINDS, cardNote, EMPTY_FACTS, infoCard, MISSING, stubInfoCardSource, type InfoCardFacts } from "./info-card";
import { FLOW_GAP_RULE } from "./types";

/** The Info card board (spec F-L4), which holds facts rather than pictures, and invents none of them. */

const FACTS: InfoCardFacts = {
  sizes: ["S", "M", "L"],
  measures: [
    { code: "A", label: "Chest, 1 inch below armhole", valuesMm: { S: 480, M: 510, L: 540 }, ruleId: "R-POM-001" },
    { code: "B", label: "Body length from HPS", valuesMm: { S: 690, M: 710 }, ruleId: "R-POM-002" },
  ],
  colours: [
    { name: "Navy", hex: "#0B1F4B", code: "C-NAV-01", ruleId: "R-COL-001" },
    { name: "Club gold", hex: null, code: null, ruleId: "R-COL-002" },
  ],
  fabrics: [{ code: "F-POLY-INT", name: "Interlock", gsm: 160, blend: null, ruleId: "R-FAB-001" }],
  features: [{ label: "Side seams", words: "Flatlocked", ruleId: "R-CON-001" }],
  care: [{ label: "Washing", words: null, ruleId: "R-CARE-001" }],
};

describe("every kind of info card", () => {
  it("is one of the five the board table names, with a heading and a lead of its own", () => {
    expect(CARD_KINDS).toEqual(["size_chart", "colour_chart", "fabric_callouts", "feature_callouts", "care_card"]);
    for (const kind of CARD_KINDS) {
      const view = infoCard(kind, FACTS);
      expect(view.title.length, kind).toBeGreaterThan(3);
      expect(view.lead.length, kind).toBeGreaterThan(20);
      expect(view.ruleId, kind).toBe(FLOW_GAP_RULE);
    }
  });

  it("has a real empty state naming the one action that fills it", () => {
    for (const kind of CARD_KINDS) {
      const view = infoCard(kind, EMPTY_FACTS);
      expect(view.empty?.action, kind).toBe("Add a Design board");
      expect(view.sections.every((section) => section.rows.length === 0), kind).toBe(true);
      expect(cardNote(view), kind).toContain("Put a design on the Design board");
    }
  });
});

describe("the size chart", () => {
  it("is garment measurements, and says so rather than letting anybody assume", () => {
    expect(infoCard("size_chart", FACTS).lead).toContain("Not body measurements");
  });

  it("puts a column per size and a row per measurement, in centimetres or inches", () => {
    const cm = infoCard("size_chart", FACTS, "cm").sections[0];
    const inches = infoCard("size_chart", FACTS, "in").sections[0];

    expect(cm?.columns).toEqual(["Measurement", "S", "M", "L"]);
    expect(cm?.rows[0]?.cells.map((cell) => cell.value)).toEqual(["48.0 cm", "51.0 cm", "54.0 cm"]);
    expect(inches?.rows[0]?.cells[0]?.value).toContain("in");
    expect(inches?.heading).toContain("inches");
  });

  it("says a missing measurement is missing instead of putting a number there", () => {
    const view = infoCard("size_chart", FACTS);
    const second = view.sections[0]?.rows[1];

    expect(second?.cells.map((cell) => cell.value)).toEqual(["69.0 cm", "71.0 cm", MISSING]);
    expect(second?.cells[2]?.missing).toBe(true);
    expect(view.missing).toBe(1);
    expect(cardNote(view)).toBe("1 value is still to be filled in, and the card says so where they are.");
  });

  it("carries the rule that explains each row", () => {
    expect(infoCard("size_chart", FACTS).sections[0]?.rows[0]?.ruleId).toBe("R-POM-001");
  });
});

describe("the other cards", () => {
  it("shows a colour with its catalogue code, and says when there is neither", () => {
    const view = infoCard("colour_chart", FACTS);

    expect(view.sections[0]?.rows[0]?.cells.map((cell) => cell.value)).toEqual(["#0B1F4B", "C-NAV-01"]);
    expect(view.sections[0]?.rows[1]?.cells.every((cell) => cell.missing)).toBe(true);
    expect(view.missing).toBe(2);
  });

  it("shows a fabric's weight in grams per square metre and says when the blend is not known", () => {
    const row = infoCard("fabric_callouts", FACTS).sections[0]?.rows[0];

    expect(row?.cells.map((cell) => cell.value)).toEqual(["F-POLY-INT", "160 g/m²", MISSING]);
  });

  it("shows the features and the care words as a list", () => {
    expect(infoCard("feature_callouts", FACTS).sections[0]?.rows[0]?.cells[0]?.value).toBe("Flatlocked");
    expect(infoCard("care_card", FACTS).sections[0]?.rows[0]?.cells[0]?.value).toBe(MISSING);
  });

  it("says when every value on a card is the garment's own", () => {
    expect(cardNote(infoCard("feature_callouts", FACTS))).toBe("Every value on this card comes from the garment's own data.");
  });
});

describe("where the facts come from", () => {
  it("is an interface with a double, so the panel is testable before the real reads are wired", async () => {
    const source = stubInfoCardSource(FACTS);

    expect(await source.facts({ designProjectId: "one", version: 3 })).toEqual(FACTS);
    expect(await stubInfoCardSource().facts({ designProjectId: "one", version: null })).toEqual(EMPTY_FACTS);
  });
});
