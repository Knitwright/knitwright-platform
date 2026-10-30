import { describe, expect, it } from "vitest";
import { preExportCheck } from "./checklist";
import { fixtureLabelInput, fixtureSubject, SEEDED_CARE_SYMBOLS, SEEDED_LABEL_RULES_GB } from "./fixtures/rows";
import { subjectForOrder, type OrderFacts } from "./from-order";
import { destinationLabel } from "./labels";

const facts = (over: Partial<OrderFacts> = {}): OrderFacts => ({
  labels: [destinationLabel(fixtureLabelInput())],
  productionClass: "A",
  humanAllowed: null,
  moderation: "clear",
  ...over,
});

describe("ordering reads the same subject the Review tab shows", () => {
  it("keeps every value of the document and changes only the source", () => {
    const document = fixtureSubject({ tbcPaths: [], needsInput: [] });
    const order = subjectForOrder(document, facts());
    expect(order.source).toBe("order");
    expect(order.poms).toBe(document.poms);
    expect(order.bom).toBe(document.bom);
    expect(order.colour).toBe(document.colour);
    expect(order.sizes).toBe(document.sizes);
  });

  it("cannot pass at hand-off what the document fails on", () => {
    const document = fixtureSubject({ tbcPaths: ["bom[0].spec"] });
    expect(preExportCheck(document).clear).toBe(false);
    expect(preExportCheck(subjectForOrder(document, facts())).clear).toBe(false);
  });

  it("is clear when the document is clear and the order's own facts are too", () => {
    expect(preExportCheck(subjectForOrder(fixtureSubject(), facts())).clear).toBe(true);
  });
});

describe("what only an order knows", () => {
  it("refuses the markets this order's pieces are going to, not the document's", () => {
    const document = fixtureSubject();
    expect(preExportCheck(document).clear).toBe(true);
    const going = subjectForOrder(document, facts({ labels: [destinationLabel(fixtureLabelInput({ labelRules: SEEDED_LABEL_RULES_GB, careSymbols: SEEDED_CARE_SYMBOLS }))] }));
    expect(preExportCheck(going).blockers.map((found) => found.code)).toContain("care_symbols_missing");
  });

  it("refuses a Class B run until a person has allowed the design", () => {
    expect(preExportCheck(subjectForOrder(fixtureSubject(), facts({ productionClass: "B" }))).clear).toBe(false);
    expect(preExportCheck(subjectForOrder(fixtureSubject(), facts({ productionClass: "B", humanAllowed: true }))).clear).toBe(true);
  });

  it("refuses a design the screen before the order flagged", () => {
    const result = preExportCheck(subjectForOrder(fixtureSubject(), facts({ moderation: "flagged" })));
    expect(result.blockers.map((found) => found.code)).toContain("moderation_flagged");
  });
});
