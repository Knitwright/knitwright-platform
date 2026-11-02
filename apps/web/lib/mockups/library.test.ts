import { describe, expect, it } from "vitest";
import {
  ARTICLE_FILTER_GAP,
  COLLECTION_PREVIEW,
  NO_FILTERS,
  anyFilterSet,
  collectionsOf,
  cropChoices,
  filterScenes,
  isPremium,
  matches,
  moodChoices,
  peopleChoices,
  sportChoices,
} from "./library";
import { ALL_MOCKUP_SCENES, aiScenes, deterministicScenes, sceneBySlug } from "./scenes";
import { SCENE_GROUPS } from "./types";

/**
 * The mockup library panel's collections, search and filters (spec F-L1, "Mockup library panel").
 * It is all pure, so every one of these runs without a shell and without a browser.
 */

const all = ALL_MOCKUP_SCENES;

describe("searching the scenes", () => {
  it("finds a scene by its title, its group, its light, its backdrop, its pose and its camera", () => {
    expect(filterScenes(all, { ...NO_FILTERS, text: "flat lay" }).map((scene) => scene.slug)).toEqual(["flat-lay-white", "flat-lay-grass"]);
    expect(filterScenes(all, { ...NO_FILTERS, text: "floodlights" }).map((scene) => scene.slug)).toEqual(["floodlit-pitch"]);
    expect(filterScenes(all, { ...NO_FILTERS, text: "outfield green" }).length).toBeGreaterThan(0);
    expect(filterScenes(all, { ...NO_FILTERS, text: "ball at feet" }).map((scene) => scene.slug)).toEqual(["floodlit-pitch"]);
  });

  it("wants every word, in any order, and ignores case and spacing", () => {
    expect(filterScenes(all, { ...NO_FILTERS, text: "  WHITE   lay " }).map((scene) => scene.slug)).toEqual(["flat-lay-white"]);
    expect(filterScenes(all, { ...NO_FILTERS, text: "white kangaroo" })).toEqual([]);
  });

  it("returns everything for an empty search", () => {
    expect(filterScenes(all, NO_FILTERS)).toHaveLength(all.length);
    expect(filterScenes(all, { ...NO_FILTERS, text: "   " })).toHaveLength(all.length);
  });
});

describe("the filters", () => {
  it("filters by sport, mood, people and aspect, and by what is free", () => {
    expect(filterScenes(all, { ...NO_FILTERS, sport: "combat" }).every((scene) => scene.sports.includes("combat"))).toBe(true);
    expect(filterScenes(all, { ...NO_FILTERS, mood: "playful" }).map((scene) => scene.slug)).toEqual(["rgb-desk"]);
    expect(filterScenes(all, { ...NO_FILTERS, people: "team" }).every((scene) => scene.people === "team")).toBe(true);
    expect(filterScenes(all, { ...NO_FILTERS, crop: "4:5" }).every((scene) => scene.crops.includes("4:5"))).toBe(true);
    expect(filterScenes(all, { ...NO_FILTERS, freeOnly: true })).toHaveLength(deterministicScenes().length);
  });

  it("drops a scene that fails any one filter", () => {
    const line = sceneBySlug("team-line-up-eleven")!;
    expect(matches(line, { ...NO_FILTERS, people: "team" })).toBe(true);
    expect(matches(line, { ...NO_FILTERS, people: "none" })).toBe(false);
    expect(matches(line, { ...NO_FILTERS, crop: "9:16" })).toBe(false);
    expect(matches(line, { ...NO_FILTERS, sport: "combat" })).toBe(false);
    expect(matches(line, { ...NO_FILTERS, mood: "playful" })).toBe(false);
    expect(matches(line, { ...NO_FILTERS, freeOnly: true })).toBe(false);
    expect(matches(line, { ...NO_FILTERS, text: "dojo" })).toBe(false);
  });

  it("tells a search nobody typed from one that found nothing", () => {
    expect(anyFilterSet(NO_FILTERS)).toBe(false);
    expect(anyFilterSet({ ...NO_FILTERS, text: " " })).toBe(false);
    expect(anyFilterSet({ ...NO_FILTERS, text: "white" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, sport: "combat" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, mood: "bold" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, people: "none" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, crop: "1:1" })).toBe(true);
    expect(anyFilterSet({ ...NO_FILTERS, freeOnly: true })).toBe(true);
  });

  it("offers a choice only where a scene would be left, with a count on each", () => {
    expect(sportChoices(all).map((choice) => choice.value)).toContain("esports");
    expect(sportChoices(all).every((choice) => choice.count > 0)).toBe(true);
    expect(moodChoices(all).map((choice) => choice.label)).toContain("Bold");
    expect(peopleChoices(all).map((choice) => choice.value)).toEqual(["none", "one", "team"]);
    expect(peopleChoices(deterministicScenes()).map((choice) => choice.value)).toEqual(["none"]);
    expect(cropChoices(all).map((choice) => choice.label)).toContain("Portrait 4:5");
    expect(sportChoices([])).toEqual([]);
  });

  it("says plainly that there is no article to filter on", () => {
    expect(ARTICLE_FILTER_GAP.ruleId).toBe("R-GAP-000");
    expect(ARTICLE_FILTER_GAP.line).toContain("F-L1 lists an article filter");
  });
});

describe("the collections", () => {
  it("shows one shelf per group of 07, in the spec's own order", () => {
    expect(collectionsOf(all).map((collection) => collection.group)).toEqual([...SCENE_GROUPS]);
  });

  it("shows a few of each until Show all, and says how many are left", () => {
    const [product] = collectionsOf(all);
    expect(product!.shown).toHaveLength(COLLECTION_PREVIEW);
    expect(product!.hidden).toBe(product!.scenes.length - COLLECTION_PREVIEW);
    const opened = collectionsOf(all, NO_FILTERS, ["product"])[0]!;
    expect(opened.shown).toHaveLength(opened.scenes.length);
    expect(opened.hidden).toBe(0);
  });

  it("leaves out a shelf with nothing on it rather than showing an empty one", () => {
    const free = collectionsOf(all, { ...NO_FILTERS, freeOnly: true });
    expect(free.map((collection) => collection.group)).toEqual(["product", "retail"]);
    expect(collectionsOf(all, { ...NO_FILTERS, text: "nothing matches this" })).toEqual([]);
  });

  it("puts the crown on exactly the scenes a model runs", () => {
    expect(all.filter(isPremium)).toHaveLength(aiScenes().length);
    expect(isPremium(sceneBySlug("product-front")!)).toBe(false);
    expect(isPremium(sceneBySlug("dojo-mat")!)).toBe(true);
  });
});
