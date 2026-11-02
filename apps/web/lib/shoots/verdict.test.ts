import { describe, expect, it } from "vitest";
import type { LaunchCostSource } from "@/lib/launch";
import { sceneBySlug } from "@/lib/mockups";
import { readBoardSettings, type ShootBoardSettings } from "./board";
import { MODEL_PRESET_CATALOGUE, MODEL_PRESET_KEYS, NO_LICENCE_LINE, modelPresetsFrom } from "./models";
import { CONSENT_STATEMENT, SHOOT_GAP_RULE } from "./types";
import {
  BACKGROUND_FILE_REASON,
  BACKGROUND_TEXT_REASON,
  BALANCE_UNKNOWN_REASON,
  LOCK_REASON,
  MODEL_NEEDED_REASON,
  PRESET_UNKNOWN_REASON,
  SCENE_REASON,
  UPLOAD_CONSENT_REASON,
  UPLOAD_FILE_REASON,
  runButtonLabel,
  runVerdict,
  showsPerson,
  type RunFacts,
} from "./verdict";

/**
 * Whether a shoot may run. The order of the refusals is the test: the garment lock and a person's
 * likeness come before the brand's wallet, because they protect somebody other than the person
 * pressing the button.
 */

const source: LaunchCostSource = { perGeneratedBoard: 1, note: "A placeholder, not a price.", ruleId: SHOOT_GAP_RULE };

const facts = (over: Partial<RunFacts> = {}): RunFacts => ({
  garmentLocked: true,
  scene: sceneBySlug("floodlit-pitch"),
  presets: MODEL_PRESET_CATALOGUE,
  balance: 100,
  creditsEnforced: false,
  source,
  ...over,
});

const licensed = modelPresetsFrom({ refs: { [MODEL_PRESET_KEYS[0]!]: "LIC-1" }, holders: {} });

const settings = (over: Partial<ShootBoardSettings> = {}): ShootBoardSettings => ({
  ...readBoardSettings({ sceneSlug: "floodlit-pitch", modelSource: "preset", modelPresetKey: MODEL_PRESET_KEYS[0] }),
  ...over,
});

describe("the refusals, in the order a person would fix them", () => {
  it("refuses a board with no design behind it first of all", () => {
    const verdict = runVerdict(settings(), facts({ garmentLocked: false, scene: null }));
    expect(verdict).toEqual({ canRun: false, reason: LOCK_REASON, ruleId: SHOOT_GAP_RULE });
  });

  it("refuses a board with no scene", () => {
    const verdict = runVerdict(settings(), facts({ scene: null }));
    expect(verdict.canRun).toBe(false);
    expect(verdict.canRun ? "" : verdict.reason).toBe(SCENE_REASON);
  });

  it("refuses a scene with a person in it and no model chosen", () => {
    const verdict = runVerdict(settings({ modelSource: "none" }), facts());
    expect(verdict.canRun ? "" : verdict.reason).toBe(MODEL_NEEDED_REASON);
  });

  it("allows a scene with nobody in it and no model chosen", () => {
    const verdict = runVerdict(settings({ modelSource: "none", sceneSlug: "kit-on-a-bench" }), facts({ scene: sceneBySlug("kit-on-a-bench") }));
    expect(verdict.canRun).toBe(true);
  });

  it("refuses a preset with no licence on file, in the preset's own words", () => {
    const verdict = runVerdict(settings(), facts());
    expect(verdict.canRun ? "" : verdict.reason).toBe(NO_LICENCE_LINE);
  });

  it("allows a preset once somebody has set its licence ref", () => {
    const verdict = runVerdict(settings(), facts({ presets: licensed }));
    expect(verdict.canRun).toBe(true);
  });

  it("refuses a preset that is no longer offered", () => {
    const verdict = runVerdict(settings({ modelPresetKey: "went-away" }), facts({ presets: licensed }));
    expect(verdict.canRun ? "" : verdict.reason).toBe(PRESET_UNKNOWN_REASON);
  });

  it("refuses an upload with no picture, and then one with no recorded consent", () => {
    expect(runVerdict(settings({ modelSource: "upload" }), facts()).canRun).toBe(false);
    const noFile = runVerdict(settings({ modelSource: "upload" }), facts());
    expect(noFile.canRun ? "" : noFile.reason).toBe(UPLOAD_FILE_REASON);
    const noConsent = runVerdict(settings({ modelSource: "upload", modelFileId: "file-1" }), facts());
    expect(noConsent.canRun ? "" : noConsent.reason).toBe(UPLOAD_CONSENT_REASON);
  });

  it("allows an upload whose consent was recorded", () => {
    const consent = { ref: "Release 4", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" };
    const verdict = runVerdict(settings({ modelSource: "upload", modelFileId: "file-1", consent }), facts());
    expect(verdict.canRun).toBe(true);
  });

  it("refuses a background that was asked for and is not there", () => {
    const upload = runVerdict(settings({ modelSource: "none", sceneSlug: "kit-on-a-bench", backgroundSource: "upload" }), facts({ scene: sceneBySlug("kit-on-a-bench") }));
    expect(upload.canRun ? "" : upload.reason).toBe(BACKGROUND_FILE_REASON);
    const words = runVerdict(settings({ modelSource: "none", sceneSlug: "kit-on-a-bench", backgroundSource: "text", backgroundText: "  " }), facts({ scene: sceneBySlug("kit-on-a-bench") }));
    expect(words.canRun ? "" : words.reason).toBe(BACKGROUND_TEXT_REASON);
  });

  it("allows a background that is there", () => {
    const given = runVerdict(
      settings({ modelSource: "none", sceneSlug: "kit-on-a-bench", backgroundSource: "upload", backgroundFileId: "file-2" }),
      facts({ scene: sceneBySlug("kit-on-a-bench") }),
    );
    expect(given.canRun).toBe(true);
  });
});

describe("the money, once everything else is in order", () => {
  it("does not look at the balance while charging is off", () => {
    const verdict = runVerdict(settings(), facts({ presets: licensed, balance: null }));
    expect(verdict.canRun).toBe(true);
  });

  it("refuses rather than guessing when the balance could not be read", () => {
    const verdict = runVerdict(settings(), facts({ presets: licensed, balance: null, creditsEnforced: true }));
    expect(verdict.canRun ? "" : verdict.reason).toBe(BALANCE_UNKNOWN_REASON);
  });

  it("says what the shoot costs and what the brand has when it cannot afford it", () => {
    const verdict = runVerdict(settings({ count: 4 }), facts({ presets: licensed, balance: 2, creditsEnforced: true }));
    expect(verdict.canRun ? "" : verdict.reason).toBe("This shoot costs 4 credits and you have 2.");
  });

  it("puts the cost on the button when it can run, and a plain word when it cannot", () => {
    const can = runVerdict(settings({ count: 2 }), facts({ presets: licensed }));
    expect(runButtonLabel(can)).toBe("Generate 2 images (2 credits)");
    expect(runButtonLabel(runVerdict(settings(), facts({ garmentLocked: false })))).toBe("Generate");
  });
});

describe("whether a picture will have a person in it", () => {
  it("is true for a scene with people, whatever the model source", () => {
    expect(showsPerson(settings({ modelSource: "none" }), sceneBySlug("floodlit-pitch"))).toBe(true);
  });

  it("is true for an uploaded model even in a scene with nobody in it", () => {
    expect(showsPerson(settings({ modelSource: "upload" }), sceneBySlug("kit-on-a-bench"))).toBe(true);
  });

  it("is false for a garment on its own", () => {
    expect(showsPerson(settings({ modelSource: "none" }), sceneBySlug("kit-on-a-bench"))).toBe(false);
    expect(showsPerson(settings({ modelSource: "none" }), null)).toBe(false);
  });
});
