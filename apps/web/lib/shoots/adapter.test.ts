import { describe, expect, it } from "vitest";
import type { LifestyleProvider } from "@/lib/media/lifestyle/provider";
import { SCENE_IDS } from "@/lib/media/lifestyle/scenes";
import { SCENE_GROUPS } from "@/lib/mockups";
import { LIFESTYLE_SCENE_OF_GROUP, SCENE_MAPPING_NOTE, chooseShootProvider, lifestyleSceneOf, shootProviderFrom } from "./adapter";
import type { ShootRequest } from "./provider";

/**
 * The bridge onto the picture providers the platform already has. The test that matters is the last
 * group: with nothing configured, and in CI, the provider is the stub, so no test and no local run
 * can make a paid call.
 */

const request: ShootRequest = {
  garment: new Uint8Array([1, 2, 3]),
  extraGarments: [],
  modelPhoto: null,
  background: null,
  prompt: "A shoot on the pitch",
  crop: "1:1",
  sceneSlug: "floodlit-pitch",
  seed: 7,
};

const signal = () => new AbortController().signal;

const fake = (over: Partial<LifestyleProvider> = {}): LifestyleProvider => ({
  name: "fake-lifestyle",
  costMicrodollars: 1200,
  scenes: SCENE_IDS,
  async generate() {
    return new Uint8Array([9, 9, 9]);
  },
  ...over,
});

describe("the mapping onto the four scenes those adapters know", () => {
  it("has one for every scene group of 07, and says on the record that it is a mapping", () => {
    for (const group of SCENE_GROUPS) expect(SCENE_IDS).toContain(lifestyleSceneOf(group));
    expect(Object.keys(LIFESTYLE_SCENE_OF_GROUP).sort()).toEqual([...SCENE_GROUPS].sort());
    expect(SCENE_MAPPING_NOTE).toMatch(/four scene names and 07 has twenty/);
  });
});

describe("an existing lifestyle provider, as a shoot provider", () => {
  it("passes the shoot's own prompt and seed, and the locked garment as both reference and garment", async () => {
    const seen: unknown[] = [];
    const provider = shootProviderFrom(
      fake({
        async generate(input) {
          seen.push(input);
          return new Uint8Array([4]);
        },
      }),
      { group: "teamwear" },
    );
    const made = await provider.generate(request, signal());
    expect(made).toEqual({ ok: true, png: new Uint8Array([4]) });
    expect(seen[0]).toEqual({ scene: "pitch", prompt: request.prompt, seed: 7, reference: request.garment, garment: request.garment, modelImage: null });
  });

  it("carries the provider's own name and cost, so a record of a run says what was really called", () => {
    const provider = shootProviderFrom(fake(), { group: "teamwear" });
    expect(provider.name).toBe("fake-lifestyle");
    expect(provider.costPerImageMicrodollars).toBe(1200);
  });

  it("refuses rather than throwing when the provider cannot make that scene", async () => {
    const provider = shootProviderFrom(fake({ scenes: ["street"] }), { group: "teamwear" });
    const made = await provider.generate(request, signal());
    expect(made.ok).toBe(false);
    expect(made.ok ? "" : made.message).toMatch(/cannot make a pitch picture/);
  });

  it("turns a provider's own error into a sentence, so the run can refund and say something", async () => {
    const provider = shootProviderFrom(
      fake({
        async generate() {
          throw new Error("the provider timed out");
        },
      }),
      { group: "retail" },
    );
    const made = await provider.generate(request, signal());
    expect(made).toEqual({ ok: false, message: "the provider timed out" });
  });

  it("says something even for a thrown value that is not an error", async () => {
    const provider = shootProviderFrom(
      fake({
        async generate() {
          throw "no";
        },
      }),
      { group: "retail" },
    );
    const made = await provider.generate(request, signal());
    expect(made.ok ? "" : made.message).toBe("The picture provider refused this shoot.");
  });
});

describe("which provider is in use", () => {
  it("is the stub with nothing configured, which is what CI and a local run see", () => {
    const choice = chooseShootProvider({}, { group: "teamwear" });
    expect(choice.live).toBe(false);
    expect(choice.provider.name).toBe("stub-shoot");
    expect(choice.provider.costPerImageMicrodollars).toBe(0);
    expect(choice.problems[0]).toMatch(/MEDIA_SHOOTS_LIVE/);
  });

  it("is the stub even with a key, until the owner has turned paid shoots on", () => {
    const choice = chooseShootProvider({ LIFESTYLE_SCENE_PROVIDER: "fal", FAL_KEY: "k" }, { group: "teamwear" });
    expect(choice.live).toBe(false);
  });

  it("is the stub when paid shoots are on but nothing is configured, and says what was wrong", () => {
    const choice = chooseShootProvider({ MEDIA_SHOOTS_LIVE: "true" }, { group: "teamwear" });
    expect(choice.live).toBe(false);
    expect(choice.problems.join(" ")).toMatch(/No configured picture provider makes a pitch picture/);
  });

  it("names the key a chosen provider is missing rather than guessing one", () => {
    const choice = chooseShootProvider({ MEDIA_SHOOTS_LIVE: "true", LIFESTYLE_SCENE_PROVIDER: "fal" }, { group: "teamwear" });
    expect(choice.live).toBe(false);
    expect(choice.problems.join(" ")).toMatch(/FAL_KEY is not set/);
  });

  it("is a real provider only when paid shoots are on and one is configured with its key", () => {
    const choice = chooseShootProvider({ MEDIA_SHOOTS_LIVE: "true", LIFESTYLE_SCENE_PROVIDER: "stub" }, { group: "teamwear" });
    expect(choice.live).toBe(true);
    expect(choice.provider.name).toBe("stub-lifestyle");
  });
});
