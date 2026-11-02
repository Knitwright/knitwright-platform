import { describe, expect, it } from "vitest";
import { VIDEO_GAP_RULE } from "./formats";
import {
  buildPrompt,
  GARMENT_LOCK_SENTENCE,
  isPresetKey,
  MAX_OWN_WORDS,
  PRESETS,
  PRESET_KEYS,
  promptPreset,
  PROMPT_PRESETS,
} from "./prompt-presets";

describe("the sportswear prompt presets", () => {
  it("are the eight the spec lists", () => {
    expect(PRESET_KEYS).toHaveLength(8);
    expect(PRESETS.map((preset) => preset.label)).toEqual([
      "Walk-out from tunnel",
      "Slow orbit",
      "Sprint past camera",
      "Ball juggle",
      "Fabric macro push-in",
      "Flag wave in wind",
      "Dolly backward",
      "Smooth tracking",
    ]);
  });

  it("give every preset a rule id, words for the card and a prompt about the camera and the scene", () => {
    for (const preset of PRESETS) {
      expect(preset.ruleId).toBe(VIDEO_GAP_RULE);
      expect(preset.lead).toMatch(/\w/);
      expect(preset.prompt.length).toBeGreaterThan(40);
    }
  });

  it("asks no preset to draw, change or add the garment, its crest or its sponsors", () => {
    for (const preset of PRESETS) {
      expect(preset.prompt, preset.key).not.toMatch(/\b(redraw|restyle|recolour|recolor|change the (?:shirt|kit|garment)|add a (?:logo|crest|sponsor))\b/i);
    }
  });

  it("reads a key, and gives nothing back for one it does not know", () => {
    expect(isPresetKey("walk_out")).toBe(true);
    expect(isPresetKey("moonwalk")).toBe(false);
    expect(promptPreset("slow_orbit")?.label).toBe("Slow orbit");
    expect(promptPreset("moonwalk")).toBeNull();
    expect(promptPreset(null)).toBeNull();
  });
});

describe("the prompt a model is sent", () => {
  it("puts the preset first, the person's own words next and the garment lock last", () => {
    const built = buildPrompt(PROMPT_PRESETS.walk_out, "night match, rain");
    expect(built.startsWith(PROMPT_PRESETS.walk_out.prompt)).toBe(true);
    expect(built).toContain("night match, rain");
    expect(built.endsWith(GARMENT_LOCK_SENTENCE)).toBe(true);
    expect(built.indexOf("night match")).toBeLessThan(built.indexOf(GARMENT_LOCK_SENTENCE));
  });

  it("carries the garment lock even with no preset and no words at all", () => {
    expect(buildPrompt(null, "")).toBe(GARMENT_LOCK_SENTENCE);
    expect(buildPrompt(null, "   ")).toBe(GARMENT_LOCK_SENTENCE);
  });

  it("locks the garment in every one of the eight presets", () => {
    for (const preset of PRESETS) expect(buildPrompt(preset, ""), preset.key).toContain(GARMENT_LOCK_SENTENCE);
  });

  it("cuts a very long request down to the limit and still ends with the lock", () => {
    const built = buildPrompt(PROMPT_PRESETS.slow_orbit, "x".repeat(MAX_OWN_WORDS + 500));
    expect(built).toContain("x".repeat(MAX_OWN_WORDS));
    expect(built).not.toContain("x".repeat(MAX_OWN_WORDS + 1));
    expect(built.endsWith(GARMENT_LOCK_SENTENCE)).toBe(true);
  });

  it("says in the lock sentence that colours, crest, sponsors, names and numbers must not change", () => {
    for (const word of ["colours", "crest", "sponsor", "names", "numbers"]) {
      expect(GARMENT_LOCK_SENTENCE.toLowerCase()).toContain(word);
    }
  });
});
