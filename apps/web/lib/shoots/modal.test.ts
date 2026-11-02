import { describe, expect, it } from "vitest";
import {
  AREA_REFUSAL,
  GARMENT_EDIT_REFUSAL,
  GARMENT_WORDS,
  MODAL_ACTIONS,
  MODAL_ACTION_LABELS,
  NO_ARTWORK_NOTE,
  PAID_ACTIONS,
  areaEditVerdict,
  garmentWordsIn,
  isPaidAction,
  modalGaps,
  promptEditVerdict,
} from "./modal";
import { SHOOT_GAP_RULE } from "./types";

/**
 * The image modal's edits. F-L1 says "scene only" twice in one sentence, so both halves are refused
 * here rather than trusted: a prompt that asks for the garment, and an area that is on it.
 */

const GARMENT = [{ x: 100, y: 100, width: 200, height: 300 }];

describe("an edit prompt", () => {
  it("is allowed when it only asks for the scene", () => {
    expect(promptEditVerdict("Make the floodlights brighter and the sky darker")).toEqual({ allowed: true });
    expect(promptEditVerdict("")).toEqual({ allowed: true });
  });

  it("is refused when it asks for the garment, and names the words it saw", () => {
    const verdict = promptEditVerdict("Change the crest and make the sponsor bigger");
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.reason).toContain(GARMENT_EDIT_REFUSAL);
    expect(verdict.reason).toContain("crest");
    expect(verdict.reason).toContain("sponsor");
    expect(verdict.ruleId).toBe(SHOOT_GAP_RULE);
  });

  it("looks at whole words, so a scene is not refused for containing one by accident", () => {
    expect(garmentWordsIn("The panelling of the stadium roof")).toEqual([]);
    expect(garmentWordsIn("more panels")).toEqual(["panels"]);
  });

  it("knows every word of the garment's own vocabulary, in one list", () => {
    for (const word of ["crest", "sponsor", "number", "colourway", "stripe"]) expect(GARMENT_WORDS).toContain(word);
    expect(promptEditVerdict("Put a NUMBER on it").allowed).toBe(false);
  });
});

describe("an edit area", () => {
  it("is allowed beside the garment", () => {
    expect(areaEditVerdict({ x: 0, y: 0, width: 80, height: 80 }, GARMENT)).toEqual({ allowed: true });
    expect(areaEditVerdict({ x: 320, y: 0, width: 80, height: 500 }, GARMENT)).toEqual({ allowed: true });
  });

  it("is refused where it overlaps the garment at all", () => {
    const verdict = areaEditVerdict({ x: 90, y: 90, width: 30, height: 30 }, GARMENT);
    expect(verdict.allowed).toBe(false);
    if (verdict.allowed) return;
    expect(verdict.reason).toBe(AREA_REFUSAL);
  });

  it("is allowed when the scene has no garment rectangle to protect", () => {
    expect(areaEditVerdict({ x: 0, y: 0, width: 10, height: 10 }, [])).toEqual({ allowed: true });
  });
});

describe("what the modal offers", () => {
  it("is every action F-L1 lists, each with words on it", () => {
    expect([...MODAL_ACTIONS]).toEqual(["prompt", "remove-background", "edit-area", "upscale", "add-text", "download", "open"]);
    for (const action of MODAL_ACTIONS) expect(MODAL_ACTION_LABELS[action].length).toBeGreaterThan(0);
  });

  it("says which actions cost credits before one is pressed", () => {
    expect(PAID_ACTIONS.every((action) => MODAL_ACTIONS.includes(action))).toBe(true);
    expect(isPaidAction("upscale")).toBe(true);
    expect(isPaidAction("download")).toBe(false);
  });

  it("never offers a way to make the picture artwork, and says so on the screen", () => {
    expect(MODAL_ACTIONS).not.toContain("use-as-artwork");
    expect(NO_ARTWORK_NOTE).toMatch(/never becomes artwork/);
  });

  it("says what it cannot do yet, with the rule that explains it", () => {
    const gaps = modalGaps();
    expect(gaps.length).toBeGreaterThan(0);
    for (const gap of gaps) expect(gap.ruleId).toBe(SHOOT_GAP_RULE);
  });
});
