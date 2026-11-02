import { describe, expect, it } from "vitest";
import { EXTENSION_SETTINGS } from "@/lib/settings/extensions";
import { MODEL_PRESET_KEYS, modelPresetsFrom, presetUsable } from "./models";
import { MODEL_LICENCE_HOLDERS_KEY, MODEL_LICENCE_REFS_KEY, SHOOT_SETTINGS, configFromFallbacks, modelLicenceConfig } from "./settings";

/**
 * The licence references as settings. The first test is the one that matters: with nothing stored,
 * no preset can be used, because an empty licence list is the only safe state before anybody has
 * read a licence.
 */

describe("the licence settings", () => {
  it("start empty, so no likeness can be generated until somebody sets one", () => {
    const config = configFromFallbacks();
    expect(config.refs).toEqual({});
    expect(config.holders).toEqual({});
    expect(modelPresetsFrom(config).some(presetUsable)).toBe(false);
  });

  it("are registered with the settings console, so an admin can set them with a history", () => {
    for (const def of SHOOT_SETTINGS) expect(EXTENSION_SETTINGS).toContain(def);
  });

  it("hold no secret, and say what each line means", () => {
    for (const def of SHOOT_SETTINGS) {
      expect(def.group).toBe("media");
      expect(def.input).toBe("lines");
      expect(def.lines).toBe("text");
      expect(def.help.length).toBeGreaterThan(40);
      expect(def.key).not.toMatch(/key|secret|token/);
    }
  });

  it("read a stored reference and holder into the shape the picker takes", () => {
    const stored: Record<string, unknown> = {
      [MODEL_LICENCE_REFS_KEY]: { [MODEL_PRESET_KEYS[0]!]: "LIC-1" },
      [MODEL_LICENCE_HOLDERS_KEY]: { [MODEL_PRESET_KEYS[0]!]: "A studio" },
    };
    const config = modelLicenceConfig((key) => stored[key]);
    expect(config.refs[MODEL_PRESET_KEYS[0]!]).toBe("LIC-1");
    expect(modelPresetsFrom(config).filter(presetUsable)).toHaveLength(1);
  });

  it("ignore a stored value that is not a record of words", () => {
    const config = modelLicenceConfig((key) => (key === MODEL_LICENCE_REFS_KEY ? ["LIC-1"] : 7));
    expect(config.refs).toEqual({});
    expect(config.holders).toEqual({});
    expect(modelLicenceConfig(() => ({ "a-preset": 7 })).refs).toEqual({});
  });

  it("refuse a preset key of the wrong shape, so a typo is seen rather than silently ignored", () => {
    const def = SHOOT_SETTINGS.find((one) => one.key === MODEL_LICENCE_REFS_KEY)!;
    expect(def.schema.safeParse({ "Not A Key": "LIC-1" }).success).toBe(false);
    expect(def.schema.safeParse({ "athletic-26-40-deep": "LIC-1" }).success).toBe(true);
    expect(def.schema.safeParse({ "athletic-26-40-deep": "" }).success).toBe(false);
  });
});
