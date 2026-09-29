import { describe, expect, it } from "vitest";
import { checkCombination } from "../combinations";
import { panelsFor, pointsOfMeasureFor } from "../applicability";
import { componentSlotsFor, seamsFor } from "../construction";
import { allCombinations } from "../fixtures/combinations";
import { createSpec, validateSpec } from "../spec";
import { FAMILY_DATA } from "./index";
import { checkFamilyData, listTypes } from "./index";

/**
 * Checks every family in the registry must pass, whatever garments it holds. A new family
 * is covered here as soon as its data is listed in `registry/index.ts`.
 */
const filled = FAMILY_DATA.filter((family) => family.types.length > 0);

const validCombinations = (typeId: string) =>
  allCombinations(typeId).filter((choices) => checkCombination(typeId, choices).length === 0);

describe.each(filled.map((family) => [family.id, family] as const))("the %s family", (_id, family) => {
  it("passes the registry check with no problem", () => {
    expect(checkFamilyData(family)).toEqual([]);
  });

  it("holds no numbers anywhere, so no size, grade or tolerance can hide in it", () => {
    expect(JSON.stringify(family).match(/\d/g)).toBeNull();
  });

  it("gives every point of measure a full how to measure sentence taken flat", () => {
    for (const point of family.pointsOfMeasure) {
      expect(point.howToMeasure.endsWith("."), point.id).toBe(true);
      expect(point.howToMeasure.length, point.id).toBeGreaterThan(50);
      expect(point.howToMeasure, point.id).toMatch(/flat/i);
    }
  });

  it("gives every rule reason a second sentence that says the way out", () => {
    for (const rule of family.rules) expect(rule.reason, rule.id).toMatch(/\.\s+Choose [^.]+\.$/);
  });

  it("keeps option labels short", () => {
    for (const option of family.options) expect(option.label.length, option.id).toBeLessThanOrEqual(30);
  });

  it("uses every option, point of measure and panel it defines in at least one type", () => {
    const usedOptions = new Set(family.types.flatMap((type) => type.options.map((entry) => entry.option)));
    const usedPoints = new Set(family.types.flatMap((type) => type.pointsOfMeasure));
    const usedPanels = new Set(family.types.flatMap((type) => type.panels));
    for (const option of family.options) expect(usedOptions.has(option.id), option.id).toBe(true);
    for (const point of family.pointsOfMeasure) expect(usedPoints.has(point.id), point.id).toBe(true);
    for (const panel of family.panels) expect(usedPanels.has(panel.id), panel.id).toBe(true);
  });

  it("starts a valid design of every type for every wearer it is made for", () => {
    for (const type of listTypes(family.id)) {
      for (const wearer of type.wearers) {
        const result = createSpec(type.id, wearer);
        expect(result.ok, `${type.id} ${wearer}`).toBe(true);
        expect(validateSpec(result.ok ? result.spec : null).ok).toBe(true);
      }
    }
  });

  it("has at least one point of measure and one artwork anchor for every valid combination", () => {
    for (const type of listTypes(family.id)) {
      for (const choices of validCombinations(type.id)) {
        const shape = { typeId: type.id, options: choices };
        expect(pointsOfMeasureFor(shape).length).toBeGreaterThan(3);
        expect(panelsFor(shape).some((panel) => panel.anchors.length > 0)).toBe(true);
      }
    }
  });

  it("joins every panel of every valid combination with a seam, and only panels it has", () => {
    let checked = 0;
    for (const type of listTypes(family.id)) {
      for (const choices of validCombinations(type.id)) {
        const shape = { typeId: type.id, options: choices };
        const present = new Set(panelsFor(shape).map((panel) => panel.id));
        const seams = seamsFor(shape);
        const joined = new Set(seams.flatMap((seam) => seam.panels.map((panel) => panel.id)));
        for (const id of present) expect(joined.has(id), `${type.id} ${id} ${JSON.stringify(choices)}`).toBe(true);
        for (const seam of seams) for (const panel of seam.panels) expect(present.has(panel.id)).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("gives every valid combination a thread, a care label and a size label to describe", () => {
    for (const type of listTypes(family.id)) {
      for (const choices of validCombinations(type.id)) {
        const slots = componentSlotsFor({ typeId: type.id, options: choices }).map((slot) => slot.id);
        expect(slots).toEqual(expect.arrayContaining(["main-thread", "care-label", "size-label"]));
      }
    }
  });

  it("marks every component that the platform proposes from general practice as a proposal", () => {
    for (const slot of family.components) {
      if (/proposes/.test(slot.help)) expect(slot.proposal, slot.id).toBe(true);
      if (slot.proposal) expect(slot.help, slot.id).toMatch(/proposes/);
    }
  });
});

describe("every family together", () => {
  it("never uses one garment type id twice", () => {
    const ids = listTypes().map((type) => type.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
