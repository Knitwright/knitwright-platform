import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { explainKitPattern, kitPatternAction, NO_PATTERN_COLOUR } from "./kit-pattern";
import { buildModelInput } from "./model-input";
import { resolveIntent } from "./resolve";

const must = (spec: GarmentSpec, action: unknown): GarmentSpec => {
  const outcome = applyAction(spec, action);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.spec;
};

const withTrim = (): GarmentSpec =>
  must(start("team-jersey"), {
    type: "update-colourway",
    colourway: { ...start("team-jersey").colourways[0], colours: [{ panelId: "neckband", colour: "Gold", provenance: "user-edited" }] },
  });

describe("a kit pattern from the assistant", () => {
  it("takes the colours the person named, marked as suggested", () => {
    const converted = kitPatternAction(start("polo"), { type: "set-kit-pattern", style: "hoops", colours: [{ colour: " gold ", swatch: "#d4af37" }] }, "ai-suggested");
    expect(converted).toEqual({
      ok: true,
      action: { type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "gold", swatch: "#d4af37" }], provenance: "ai-suggested" } },
    });
  });

  it("falls back on the pattern's own colours, then the trim colour, and asks when there is neither", () => {
    expect(kitPatternAction(start("polo"), { type: "set-kit-pattern", style: "sash" }, "ai-suggested")).toEqual({ ok: false, reason: NO_PATTERN_COLOUR });
    const trimmed = kitPatternAction(withTrim(), { type: "set-kit-pattern", style: "hoops" }, "ai-suggested");
    expect(trimmed.ok && trimmed.action.type === "set-kit-pattern" && trimmed.action.kitPattern.colours).toEqual([{ colour: "Gold" }]);
    const patterned = must(start("team-jersey"), {
      type: "set-kit-pattern",
      kitPattern: { style: "hoops", colours: [{ colour: "Red" }], size: 900, technique: "sublimation", provenance: "user-edited" },
    });
    const same = kitPatternAction(patterned, { type: "set-kit-pattern", style: "hoops" }, "ai-suggested");
    expect(same.ok && same.action.type === "set-kit-pattern" && same.action.kitPattern).toMatchObject({ colours: [{ colour: "Red" }], size: 900, technique: "sublimation" });
    const other = kitPatternAction(patterned, { type: "set-kit-pattern", style: "sash" }, "ai-suggested");
    expect(other.ok && other.action.type === "set-kit-pattern" && Object.hasOwn(other.action.kitPattern, "size")).toBe(false);
  });

  it("keeps the dot spacing when a model asks for dots again, and drops it for another style", () => {
    const layout = { pitch: 700, rowStep: 350, halfDrop: true, clearSpace: 100 };
    const dotted = must(start("team-jersey"), {
      type: "set-kit-pattern",
      kitPattern: { style: "dots", colours: [{ colour: "Red" }, { colour: "Blue" }], size: 300, dots: layout, provenance: "user-edited" },
    });
    const same = kitPatternAction(dotted, { type: "set-kit-pattern", style: "dots" }, "ai-suggested");
    expect(same.ok && same.action.type === "set-kit-pattern" && same.action.kitPattern).toMatchObject({ size: 300, dots: layout });
    const other = kitPatternAction(dotted, { type: "set-kit-pattern", style: "hoops" }, "ai-suggested");
    expect(other.ok && other.action.type === "set-kit-pattern" && Object.hasOwn(other.action.kitPattern, "dots")).toBe(false);
  });

  it("says what changed in one sentence", () => {
    const before = start("team-jersey");
    const set = must(before, { type: "set-kit-pattern", kitPattern: { style: "sash", colours: [{ colour: "Red" }], provenance: "ai-suggested" } });
    expect(explainKitPattern(before, set)).toEqual(["Kit pattern set to Sash in Red."]);
    const changed = must(set, { type: "set-kit-pattern", kitPattern: { style: "hoops", colours: [{ colour: "", swatch: "#ffffff" }], provenance: "ai-suggested" } });
    expect(explainKitPattern(set, changed)).toEqual(["Kit pattern changed to Hoops in screen colour #ffffff."]);
    expect(explainKitPattern(set, must(set, { type: "remove-kit-pattern" }))).toEqual(["Kit pattern removed. The kit is plain."]);
    expect(explainKitPattern(set, set)).toEqual([]);
  });

  it("makes a kit plain from a model's reply, and tells the model about patterns", () => {
    const set = must(start("team-jersey"), { type: "set-kit-pattern", kitPattern: { style: "sash", colours: [{ colour: "Red" }], provenance: "user-edited" } });
    const outcome = resolveIntent({ utterance: "make it plain", spec: set, raw: JSON.stringify({ kind: "changes", actions: [{ type: "remove-kit-pattern" }] }) });
    expect(outcome.kind).toBe("applied");
    const input = buildModelInput({ spec: set, utterance: "make it plain" });
    expect(input.system).toContain('"type": "set-kit-pattern"');
    expect(input.user).toContain('"kitPattern"');
  });
});
