import { describe, expect, it } from "vitest";
import { RULE_ID_PATTERN } from "@/lib/validation/rules";
import { draft, layer } from "./fixtures/drafts";
import { publishBlocked, REPEAT_FINDING_CODES, repeatFindings } from "./findings";

/**
 * Every finding carries the rulebook entry behind it (spec decision 11). The resolution bar is the
 * guardrails' own 150 DPI setting, so a repeat and a piece of artwork are judged by the same bar.
 */

const codes = (over: Parameters<typeof draft>[0] = {}) => repeatFindings(draft(over)).map((entry) => entry.code);

describe("what is wrong with a repeat", () => {
  it("finds nothing wrong with a named 10 cm tile with a picture in the middle", () => {
    expect(repeatFindings(draft())).toEqual([]);
    expect(publishBlocked(draft())).toBe(false);
  });

  it("gives every finding a rule id of the right shape", () => {
    const all = repeatFindings(draft({ name: "", layers: [] }));
    expect(all.length).toBeGreaterThan(0);
    expect(all.every((entry) => RULE_ID_PATTERN.test(entry.ruleId))).toBe(true);
  });

  it("names every code it can make, so the gaps can be listed", () => {
    const all = [...codes({ name: "", layers: [] }), ...codes({ wrap: false, layers: [layer({ xTenths: 0 })] }), ...codes({ layers: [layer({ widthTenths: 1000, sourcePx: { width: 200, height: 200 } })] })];
    expect(new Set(all).size).toBeGreaterThan(0);
    for (const code of new Set(all)) expect(REPEAT_FINDING_CODES).toContain(code);
  });

  it("blocks a repeat with no name and one with a name too long", () => {
    expect(codes({ name: "  " })).toContain("repeat-no-name");
    expect(codes({ name: "x".repeat(81) })).toContain("repeat-no-name");
    expect(codes({ name: "x".repeat(80) })).not.toContain("repeat-no-name");
  });

  it("blocks a tile outside the size we can print, and says the range", () => {
    const found = repeatFindings(draft({ tile: { widthTenths: 30_000, heightTenths: 1000 } }));
    expect(found[0]).toMatchObject({ code: "repeat-tile-out-of-range", severity: "blocker" });
    expect(found[0]?.action).toContain("not reviewed by a print house");
    expect(codes({ tile: { widthTenths: 1000, heightTenths: 1 } })).toContain("repeat-tile-out-of-range");
  });

  it("blocks an empty tile", () => {
    expect(codes({ layers: [] })).toContain("repeat-no-layers");
    expect(publishBlocked(draft({ layers: [] }))).toBe(true);
  });

  it("warns about a layer cut by the tile's edge only where the tile does not join at the edges", () => {
    const over = [layer({ id: "a", xTenths: 0 })];
    expect(codes({ wrap: false, layers: over })).toEqual(["repeat-layer-outside-tile"]);
    expect(codes({ wrap: true, layers: over })).toEqual([]);
    const warning = repeatFindings(draft({ wrap: false, layers: over }))[0];
    expect(warning).toMatchObject({ severity: "warning", layerId: "a" });
    expect(warning?.message).toContain("Club stripe");
  });

  it("warns about a picture under the resolution bar at the size it is drawn, against R-SUB-003", () => {
    const thin = repeatFindings(draft({ layers: [layer({ widthTenths: 2000, sourcePx: { width: 300, height: 300 } })] }));
    expect(thin[0]).toMatchObject({ code: "repeat-min-dpi", ruleId: "R-SUB-003", severity: "warning" });
    expect(thin[0]?.message).toContain("150 DPI");
    // The same picture drawn small enough is fine.
    expect(codes({ layers: [layer({ widthTenths: 400, sourcePx: { width: 300, height: 300 } })] })).toEqual([]);
  });

  it("says nothing about the resolution of a drawn shape, which has no pixels", () => {
    expect(codes({ layers: [layer({ artworkId: null, shape: "stripe", sourcePx: null, widthTenths: 2000 })] })).toEqual([]);
  });

  it("puts blockers before warnings, and a warning alone never blocks publishing", () => {
    const both = repeatFindings(draft({ name: "", wrap: false, layers: [layer({ xTenths: 0 })] }));
    expect(both.map((entry) => entry.severity)).toEqual(["blocker", "warning"]);
    expect(publishBlocked(draft({ wrap: false, layers: [layer({ xTenths: 0 })] }))).toBe(false);
  });
});
