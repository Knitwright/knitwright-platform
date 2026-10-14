import { describe, expect, it } from "vitest";
import { emptyReport, item, parseReport } from "./report";
import { parseStored } from "./stored";
import { starterTemplate } from "./template";
import { confidenceWords, staged } from "./types";

describe("reports", () => {
  it("starts empty with the limits already in it", () => {
    const report = emptyReport();
    expect(report).toMatchObject({ pictureKind: "unknown", items: [], missing: [], warnings: [], used: { visionCalls: 0, imageEdits: 0 }, fittedTo: "" });
    expect(report.limits.length).toBeGreaterThanOrEqual(5);
    expect(parseReport(JSON.parse(JSON.stringify(report)))).toEqual(report);
  });

  it("keeps what it is given", () => {
    const report = emptyReport({ pictureKind: "flat", warnings: ["w"], used: { visionCalls: 2, imageEdits: 1 }, fittedTo: "to a starter" });
    expect(report).toMatchObject({ pictureKind: "flat", warnings: ["w"], used: { visionCalls: 2, imageEdits: 1 }, fittedTo: "to a starter" });
  });

  it("clamps a confidence and names it in words", () => {
    expect(item("a", "colours", "L", 1.7, "n").confidence).toBe(1);
    expect(item("a", "colours", "L", -1, "n").confidenceWords).toBe("low");
    expect([0.9, 0.5, 0.2].map(confidenceWords)).toEqual(["high", "medium", "low"]);
    expect(staged(1, 5, "n").confidence).toBe(1);
  });

  it("refuses stored JSON that is not a report", () => {
    expect(parseReport({ heading: "other" })).toBeNull();
    expect(parseReport(null)).toBeNull();
  });
});

describe("stored landmarks", () => {
  const good = { picture: { width: 10, height: 10 }, size: "M", views: [] };

  it("reads a good set and refuses a bad one", () => {
    expect(parseStored(good)).toEqual(good);
    expect(parseStored({ ...good, size: "" })).toBeNull();
    expect(parseStored("x")).toBeNull();
  });
});

describe("the starter template", () => {
  it("has a front and a back, and nothing for a view it cannot stand in for", () => {
    expect(starterTemplate.templateFor("front", "M")?.["cf-neck"]).toBeDefined();
    expect(starterTemplate.templateFor("back", "M")?.["cb-neck"]).toBeDefined();
    expect(starterTemplate.templateFor("back", "M")?.["cf-neck"]).toBeUndefined();
    expect(starterTemplate.templateFor("collar", "M")).toBeNull();
    expect(starterTemplate.description).toMatch(/starter outline/);
  });
});
