import { describe, expect, it } from "vitest";
import { TAB_LABELS, TAB_LEADS, TECHPACK_TABS, isTechPackTab, tabOr, tabPanelId, tabTestId } from "./tabs";

/** Spec F-S6's tab table: eleven tabs in this order, with Review last. */
describe("the tech pack tabs", () => {
  it("are the eleven the spec names, in the spec's order", () => {
    expect(TECHPACK_TABS.map((id) => TAB_LABELS[id])).toEqual([
      "Overview",
      "Body",
      "Measurements",
      "Materials (BOM)",
      "Callouts",
      "Artworks",
      "Colourways",
      "Personalisation",
      "Labels & packaging",
      "QC",
      "Review",
    ]);
  });

  it("each say in one line what the tab is for", () => {
    for (const id of TECHPACK_TABS) {
      expect(TAB_LEADS[id].length, id).toBeGreaterThan(20);
      expect(TAB_LEADS[id].endsWith("."), id).toBe(true);
    }
  });

  it("give each tab its own test id and panel id", () => {
    const ids = TECHPACK_TABS.flatMap((id) => [tabTestId(id), tabPanelId(id)]);
    expect(new Set(ids).size).toBe(ids.length);
    expect(tabTestId("measurements")).toBe("techpack-tab-measurements");
    expect(tabPanelId("review")).toBe("techpack-panel-review");
  });

  it("recognise a tab read from an address and fall back to Overview for anything else", () => {
    expect(isTechPackTab("qc")).toBe(true);
    expect(isTechPackTab("nothing")).toBe(false);
    expect(tabOr("labels")).toBe("labels");
    expect(tabOr("nothing")).toBe("overview");
    expect(tabOr(null)).toBe("overview");
    expect(tabOr(undefined)).toBe("overview");
  });
});
