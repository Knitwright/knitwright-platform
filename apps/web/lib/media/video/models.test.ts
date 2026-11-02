import { describe, expect, it } from "vitest";
import { findSetting } from "@/lib/settings/registry";
import { VIDEO_GAP_RULE } from "./formats";
import {
  CHECK_FRAMES_KEY,
  checkFrameCount,
  COMMERCIAL_LICENCE_KEY,
  configFromFallbacks,
  CREDITS_PER_SECOND_KEY,
  MODELS_OFFERED_KEY,
  VIDEO_SETTINGS,
  videoModelConfig,
} from "./model-settings";
import {
  DEFAULT_CHECK_FRAMES,
  estimatedWait,
  findModel,
  licenceLabel,
  MODEL_CATALOGUE,
  PLACEHOLDER_CREDITS_PER_SECOND,
  PLACEHOLDER_MODEL_CONFIG,
  unknownModelKeys,
  videoCost,
  videoModelsFrom,
  type VideoModelConfig,
} from "./models";

const config = (over: Partial<VideoModelConfig> = {}): VideoModelConfig => ({
  offered: ["kling-2.1-standard", "veo-3"],
  creditsPerSecond: { "kling-2.1-standard": 2 },
  commercialLicence: ["veo-3"],
  ...over,
});

describe("the placeholder catalogue", () => {
  it("describes the candidates the spec names and claims no licence for any of them", () => {
    expect(MODEL_CATALOGUE.length).toBeGreaterThanOrEqual(4);
    for (const model of MODEL_CATALOGUE) {
      expect(model.commercialLicence, model.key).toBe(false);
      expect(model.creditsPerSecond, model.key).toBeNull();
      expect(model.note).toMatch(/placeholder/i);
      expect(model.ruleId).toBe(VIDEO_GAP_RULE);
      expect(model.lead).toMatch(/\w/);
      expect(model.estimatedWaitPerSecond).toBeGreaterThan(0);
    }
  });
});

describe("the list an admin has configured", () => {
  it("is in the admin's own order, with the admin's prices and licence flags on it", () => {
    const models = videoModelsFrom(config());
    expect(models.map((model) => model.key)).toEqual(["kling-2.1-standard", "veo-3"]);
    expect(models[0]).toMatchObject({ creditsPerSecond: 2, commercialLicence: false });
    expect(models[1]).toMatchObject({ creditsPerSecond: null, commercialLicence: true });
  });

  it("leaves out a key nothing describes, and names it instead of showing a blank card", () => {
    const made = config({ offered: ["kling-2.1-standard", "made-up-model"] });
    expect(videoModelsFrom(made).map((model) => model.key)).toEqual(["kling-2.1-standard"]);
    expect(unknownModelKeys(made)).toEqual(["made-up-model"]);
    expect(unknownModelKeys(config())).toEqual([]);
  });

  it("treats a price that is not a number, or is negative, as a price nobody set", () => {
    const made = config({ creditsPerSecond: { "kling-2.1-standard": -1, "veo-3": Number.NaN } });
    expect(videoModelsFrom(made).every((model) => model.creditsPerSecond === null)).toBe(true);
  });

  it("offers nothing at all when an admin has emptied the list", () => {
    expect(videoModelsFrom(config({ offered: [] }))).toEqual([]);
  });

  it("finds a model by key and nothing for anything else", () => {
    const models = videoModelsFrom(config());
    expect(findModel(models, "veo-3")?.label).toBe("Veo 3");
    expect(findModel(models, "wan-2.2")).toBeNull();
    expect(findModel(models, 7)).toBeNull();
  });
});

describe("what a run costs", () => {
  const priced = videoModelsFrom(config())[0]!;
  const unpriced = videoModelsFrom(config())[1]!;

  it("shows the credits on the button before anything is spent", () => {
    const cost = videoCost(priced, 5);
    expect(cost).toMatchObject({ priced: true, credits: 10, perSecond: 2 });
    expect(cost.label).toBe("Generate (10 credits)");
  });

  it("rounds a part credit up, so a run is never charged less than it costs", () => {
    const half = { ...priced, creditsPerSecond: 0.5 };
    expect(videoCost(half, 3)).toMatchObject({ priced: true, credits: 2 });
    expect(videoCost(half, 2)).toMatchObject({ priced: true, credits: 1 });
  });

  it("writes one credit in the singular", () => {
    expect(videoCost({ ...priced, creditsPerSecond: 1 }, 1).label).toBe("Generate (1 credit)");
  });

  it("refuses to price a model nobody has priced, and says so on the button", () => {
    const cost = videoCost(unpriced, 5);
    expect(cost.priced).toBe(false);
    if (cost.priced) return;
    expect(cost.reason).toContain("Veo 3");
    expect(cost.label).toBe("Credits a second not set");
  });

  it("never gives a negative cost for a nonsense length", () => {
    expect(videoCost(priced, -5)).toMatchObject({ credits: 0 });
  });

  it("puts the licence on the button, and says plainly when nobody has confirmed one", () => {
    expect(licenceLabel(unpriced)).toBe("Commercial licence");
    expect(licenceLabel(priced)).toBe("No commercial licence on file");
  });

  it("estimates the wait from the model's own figure, and never says zero", () => {
    expect(estimatedWait(priced, 5)).toBe(priced.estimatedWaitPerSecond * 5);
    expect(estimatedWait(priced, 0)).toBe(1);
  });
});

describe("the settings a platform admin sets", () => {
  it("are registered, so the console can show them", () => {
    for (const def of VIDEO_SETTINGS) expect(findSetting(def.key), def.key).toBeDefined();
  });

  it("hold no secret and no key", () => {
    for (const def of VIDEO_SETTINGS) expect(`${def.key} ${def.label} ${def.help}`).not.toMatch(/secret|api.?key|password|token/i);
  });

  it("have defaults that pass their own schemas", () => {
    for (const def of VIDEO_SETTINGS) expect(def.schema.safeParse(def.fallback).success, def.key).toBe(true);
  });

  it("read the same placeholder out of their own fallbacks as the panel uses", () => {
    expect(configFromFallbacks()).toEqual(PLACEHOLDER_MODEL_CONFIG);
  });

  it("start with the placeholder price, every candidate offered and no commercial licence claimed", () => {
    expect(PLACEHOLDER_MODEL_CONFIG.offered).toEqual(MODEL_CATALOGUE.map((model) => model.key));
    expect(PLACEHOLDER_MODEL_CONFIG.commercialLicence).toEqual([]);
    for (const key of PLACEHOLDER_MODEL_CONFIG.offered) {
      expect(PLACEHOLDER_MODEL_CONFIG.creditsPerSecond[key]).toBe(PLACEHOLDER_CREDITS_PER_SECOND);
    }
  });

  it("reads a store, ignoring anything of the wrong shape", () => {
    const read = (key: string): unknown =>
      ({ [MODELS_OFFERED_KEY]: ["veo-3", 7], [CREDITS_PER_SECOND_KEY]: { "veo-3": 3, "wan-2.2": "free" }, [COMMERCIAL_LICENCE_KEY]: "veo-3" })[key];
    expect(videoModelConfig(read)).toEqual({ offered: ["veo-3"], creditsPerSecond: { "veo-3": 3 }, commercialLicence: [] });
    expect(videoModelConfig(() => undefined)).toEqual({ offered: [], creditsPerSecond: {}, commercialLicence: [] });
  });

  it("reads how many frames the checker samples, and falls back to the default for anything odd", () => {
    expect(checkFrameCount((key) => (key === CHECK_FRAMES_KEY ? 9 : undefined))).toBe(9);
    expect(checkFrameCount(() => 0)).toBe(DEFAULT_CHECK_FRAMES);
    expect(checkFrameCount(() => 2.5)).toBe(DEFAULT_CHECK_FRAMES);
    expect(checkFrameCount(() => 61)).toBe(DEFAULT_CHECK_FRAMES);
    expect(checkFrameCount(() => "five")).toBe(DEFAULT_CHECK_FRAMES);
  });

  it("refuses a model key that is not a key", () => {
    const def = VIDEO_SETTINGS.find((one) => one.key === MODELS_OFFERED_KEY)!;
    expect(def.schema.safeParse(["Kling 2.1"]).success).toBe(false);
    expect(def.schema.safeParse(["kling-2.1-standard"]).success).toBe(true);
  });
});
