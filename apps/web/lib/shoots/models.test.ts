import { describe, expect, it } from "vitest";
import {
  MODEL_PRESET_CATALOGUE,
  MODEL_PRESET_KEYS,
  NO_LICENCE_LINE,
  NO_LICENCES,
  consentFrom,
  consentOf,
  findPreset,
  licenceLabel,
  modelPresetsFrom,
  presetUsable,
  usablePresets,
} from "./models";
import { CONSENT_STATEMENT, SHOOT_GAP_RULE } from "./types";

/**
 * The model presets and the consent beside them. This is the file where the workstream could do the
 * most harm, so these are the tests of the two refusals: a likeness with no licence on file cannot
 * be generated, and an upload with no recorded consent cannot either.
 */

describe("the model presets", () => {
  it("have no licence on file until somebody sets one, so none of them can be used", () => {
    expect(MODEL_PRESET_CATALOGUE.length).toBeGreaterThan(0);
    for (const preset of MODEL_PRESET_CATALOGUE) {
      expect(preset.licenceRef, preset.key).toBeNull();
      expect(preset.licenceHolder, preset.key).toBeNull();
      expect(presetUsable(preset), preset.key).toBe(false);
      expect(licenceLabel(preset)).toBe(NO_LICENCE_LINE);
    }
    expect(usablePresets(MODEL_PRESET_CATALOGUE)).toEqual([]);
  });

  it("cover the body types, age bands and skin tones F-L1 asks the library to hold", () => {
    expect(new Set(MODEL_PRESET_CATALOGUE.map((preset) => preset.bodyType)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(MODEL_PRESET_CATALOGUE.map((preset) => preset.ageBand)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(MODEL_PRESET_CATALOGUE.map((preset) => preset.skinTone)).size).toBeGreaterThanOrEqual(3);
  });

  it("name nobody: a label is a description of a range, never a person", () => {
    for (const preset of MODEL_PRESET_CATALOGUE) {
      expect(preset.label).toBe(`${preset.bodyType}, ${preset.ageBand}, ${preset.skinTone}`);
      expect(preset.note).toMatch(/No preset has a licence on file/);
      expect(preset.ruleId).toBe(SHOOT_GAP_RULE);
      // A row carries no picture, and there is no field for one to arrive in.
      expect(Object.keys(preset).sort()).toEqual(["ageBand", "bodyType", "key", "label", "licenceHolder", "licenceRef", "note", "ruleId", "skinTone"]);
    }
  });

  it("take the licence ref an admin sets, with the holder beside it", () => {
    const presets = modelPresetsFrom({ refs: { [MODEL_PRESET_KEYS[0]!]: " LIC-1 " }, holders: { [MODEL_PRESET_KEYS[0]!]: " A studio " } });
    const first = presets[0]!;
    expect(first.licenceRef).toBe("LIC-1");
    expect(first.licenceHolder).toBe("A studio");
    expect(presetUsable(first)).toBe(true);
    expect(licenceLabel(first)).toBe("Licence LIC-1 (A studio)");
    expect(usablePresets(presets)).toHaveLength(1);
  });

  it("ignore a ref that is empty, of the wrong type, or for a key nothing describes", () => {
    const presets = modelPresetsFrom({ refs: { [MODEL_PRESET_KEYS[0]!]: "   ", "not-a-preset": "LIC-9" }, holders: {} });
    expect(presets.every((preset) => preset.licenceRef === null)).toBe(true);
    expect(modelPresetsFrom(NO_LICENCES)).toHaveLength(MODEL_PRESET_CATALOGUE.length);
  });

  it("keeps a licence with no holder, because the ref is the fact and the holder is a courtesy", () => {
    const presets = modelPresetsFrom({ refs: { [MODEL_PRESET_KEYS[1]!]: "LIC-2" }, holders: { [MODEL_PRESET_KEYS[1]!]: "  " } });
    expect(presets[1]!.licenceRef).toBe("LIC-2");
    expect(presets[1]!.licenceHolder).toBeNull();
    expect(licenceLabel(presets[1]!)).toBe("Licence LIC-2");
  });

  it("are found by key and by nothing else", () => {
    expect(findPreset(MODEL_PRESET_CATALOGUE, MODEL_PRESET_KEYS[0])!.key).toBe(MODEL_PRESET_KEYS[0]);
    expect(findPreset(MODEL_PRESET_CATALOGUE, "nobody")).toBeNull();
    expect(findPreset(MODEL_PRESET_CATALOGUE, 7)).toBeNull();
    expect(findPreset(MODEL_PRESET_CATALOGUE, null)).toBeNull();
  });
});

describe("the consent a brand records for its own model", () => {
  it("keeps the reference, the words that were ticked and when, trimmed", () => {
    const consent = consentFrom({ ref: " Release 4 ", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" });
    expect(consent).toEqual({ ref: "Release 4", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" });
  });

  it("is nothing at all when any of the three is missing: half a consent is no consent", () => {
    expect(consentFrom({ statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" })).toBeNull();
    expect(consentFrom({ ref: "Release 4", givenAt: "2026-11-02T09:00:00.000Z" })).toBeNull();
    expect(consentFrom({ ref: "Release 4", statement: CONSENT_STATEMENT })).toBeNull();
    expect(consentFrom({ ref: " ", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" })).toBeNull();
  });

  it("is nothing when the date is not a date, because when it happened is part of the record", () => {
    expect(consentFrom({ ref: "Release 4", statement: CONSENT_STATEMENT, givenAt: "whenever" })).toBeNull();
  });

  it("is nothing for a value that is not an object at all", () => {
    for (const value of [null, undefined, "yes", 1, []]) expect(consentFrom(value)).toBeNull();
  });

  it("is made with our own words and the moment it was given", () => {
    const consent = consentOf("Release 9", new Date("2026-11-02T10:11:12.000Z"))!;
    expect(consent.statement).toBe(CONSENT_STATEMENT);
    expect(consent.givenAt).toBe("2026-11-02T10:11:12.000Z");
    expect(consentOf("  ", new Date())).toBeNull();
  });
});
