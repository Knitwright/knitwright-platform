import { describe, expect, it } from "vitest";
import { FIELD_PROVENANCE } from "@/lib/kpp/model";
import { GAP_RULE, PROVENANCE_CHIPS, PROVENANCE_ORDER, PROVENANCE_TONE, baseLength, cell, countProvenance, fromBase, fromDesign, isNeedsInput, needsInput } from "./fields";

/**
 * Spec F-S6: "Every field shows provenance: From base (green), From design (blue), Needs your
 * input (amber), Confirmed." The words are the production package's own (X5), so the tech pack and
 * the package a factory receives cannot label a value's source differently.
 */
describe("the provenance chips", () => {
  it("are the four the spec names, in the spec's order, and no others", () => {
    expect(PROVENANCE_ORDER).toEqual([...FIELD_PROVENANCE]);
    expect(PROVENANCE_ORDER.map((id) => PROVENANCE_CHIPS[id])).toEqual(["From base", "From design", "Needs your input", "Confirmed"]);
  });

  it("carry the colours the spec gives them", () => {
    expect(PROVENANCE_TONE.from_base).toBe("green");
    expect(PROVENANCE_TONE.from_design).toBe("blue");
    expect(PROVENANCE_TONE.needs_input).toBe("amber");
  });
});

describe("a cell of the view", () => {
  it("takes the chip the caller asked for when it holds a value", () => {
    const entry = fromBase({ id: "a", label: "Chest width", text: "520 mm", ruleId: "R-FIT-001" });
    expect(entry).toEqual({ id: "a", label: "Chest width", text: "520 mm", provenance: "from_base", ruleId: "R-FIT-001", locked: true });
  });

  it("reads as a question whatever the caller asked for, when nobody has the value", () => {
    for (const text of [null, "", "   "]) {
      const entry = cell({ id: "a", label: "Season", text, provenance: "from_base", locked: true });
      expect(entry.provenance).toBe("needs_input");
      expect(entry.text).toBeNull();
      expect(entry.locked).toBe(false);
      expect(isNeedsInput(entry)).toBe(true);
    }
  });

  it("falls back to the gap rule rather than carrying no rule at all", () => {
    expect(cell({ id: "a", label: "A", text: "x", provenance: "from_design" }).ruleId).toBe(GAP_RULE);
    expect(cell({ id: "a", label: "A", text: "x", provenance: "from_design", ruleId: "" }).ruleId).toBe(GAP_RULE);
    expect(cell({ id: "a", label: "A", text: "x", provenance: "from_design", ruleId: null }).ruleId).toBe(GAP_RULE);
  });

  it("locks a value from the base and leaves one from the design unlocked", () => {
    expect(fromBase({ id: "a", label: "A", text: "x" }).locked).toBe(true);
    expect(fromDesign({ id: "b", label: "B", text: "x" }).locked).toBe(false);
  });

  it("reads a length from the base in the chosen unit, and leaves a missing one empty", () => {
    expect(baseLength({ id: "a", label: "Chest", mm: 520, ruleId: "R-FIT-001" }, "cm").text).toBe("52.0 cm");
    expect(baseLength({ id: "a", label: "Chest", mm: null, ruleId: "R-FIT-001" }, "cm").text).toBeNull();
  });

  it("counts how many cells wear each chip", () => {
    const counts = countProvenance([
      fromBase({ id: "a", label: "A", text: "x" }),
      fromDesign({ id: "b", label: "B", text: "y" }),
      needsInput({ id: "c", label: "C" }),
      needsInput({ id: "d", label: "D" }),
    ]);
    expect(counts).toEqual({ from_base: 1, from_design: 1, needs_input: 2, confirmed: 0 });
  });
});
