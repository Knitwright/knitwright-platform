import { describe, expect, it } from "vitest";
import { isInsideApproxGamut } from "@/lib/guardrails/gamut";
import { colourFindings, colourView, colourViews } from "./colours";
import { colour, palette } from "./fixtures/brand";
import { RULES } from "./words";

/** F-S9 Colours: hex, Pantone TCX as typed, and the nearest sublimation-safe match with a warning. */

const PALETTE = { id: "p1", name: "Primary" };

describe("colourView", () => {
  it("keeps a colour the estimate accepts and warns about nothing", () => {
    const view = colourView(PALETTE, colour({ hex: "#0b1f4b" }));
    expect(view).toMatchObject({ hex: "#0b1f4b", safeHex: "#0b1f4b", inGamut: true, deltaE: 0, findings: [] });
    expect(view.paletteName).toBe("Primary");
  });

  it("warns about a colour the estimate refuses, with the nearest it accepts and the gap", () => {
    const [finding, ...rest] = colourView(PALETTE, colour({ hex: "#0000ff" })).findings;
    expect(rest).toEqual([]);
    expect(finding).toMatchObject({ code: "gamut-estimate", severity: "warning", ruleId: RULES.gamutEstimate, subject: "Club red" });
    expect(finding!.message).toContain("Knitwright's own estimate");
    expect(finding!.fix).toMatch(/#[0-9a-f]{6}/);
  });

  it("offers a safe colour the estimate really does accept", () => {
    const view = colourView(PALETTE, colour({ hex: "#00ff00" }));
    expect(view.inGamut).toBe(false);
    expect(isInsideApproxGamut(view.safeHex)).toBe(true);
    expect(view.deltaE).toBeGreaterThan(0);
  });

  it("never invents a Pantone code, and says so when there is none", () => {
    const view = colourView(PALETTE, colour({ pantoneTcx: null, hex: "#0b1f4b" }));
    expect(view.pantoneTcx).toBeNull();
    expect(view.findings.map((finding) => finding.code)).toEqual(["screen-colour"]);
    expect(view.findings[0]!.ruleId).toBe(RULES.colourStrikeOff);
    expect(view.findings[0]!.message).toContain("no Pantone TCX code");
  });

  it("leaves a colour that carries a code with nothing to say about it", () => {
    expect(colourView(PALETTE, colour({ pantoneTcx: "19-4052 TCX", hex: "#0b1f4b" })).findings).toEqual([]);
  });

  it("calls an unnamed colour by its hex, so a sentence still reads", () => {
    expect(colourView(PALETTE, colour({ name: "  ", pantoneTcx: null })).findings[0]!.subject).toBe("#c8102e");
  });

  it("rounds the difference to two places, so two runs show the same number", () => {
    const view = colourView(PALETTE, colour({ hex: "#ff00ff" }));
    expect(view.deltaE).toBe(Math.round(view.deltaE * 100) / 100);
  });
});

describe("colourViews and colourFindings", () => {
  it("walks every palette in order", () => {
    const views = colourViews([
      palette({ id: "p1", name: "Primary", colours: [colour({ id: "a" })] }),
      palette({ id: "p2", name: "Kit colours", colours: [colour({ id: "b" }), colour({ id: "c" })] }),
    ]);
    expect(views.map((view) => [view.paletteId, view.id])).toEqual([
      ["p1", "a"],
      ["p2", "b"],
      ["p2", "c"],
    ]);
  });

  it("gathers the findings of every colour for the Overview", () => {
    const findings = colourFindings([palette({ colours: [colour({ hex: "#0000ff", pantoneTcx: null })] })]);
    expect(findings.map((finding) => finding.code)).toEqual(["gamut-estimate", "screen-colour"]);
    expect(findings.every((finding) => finding.ruleId !== "")).toBe(true);
  });

  it("has nothing to say about a brand with no palette", () => {
    expect(colourFindings([])).toEqual([]);
  });
});
