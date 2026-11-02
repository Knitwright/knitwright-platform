import { describe, expect, it } from "vitest";
import { LAUNCH_COUNTS } from "@/lib/templates/kinds";
import { MOOD_TAGS, SPORT_TAGS } from "@/lib/templates/kinds/tags";
import { BACKDROPS } from "../backdrops";
import { CROPS, SCENE_GROUPS } from "../types";
import { FOR_L3_NOTE, SEEDED_SCENE_NOTE, at, centre, sceneOf } from "./build";
import { ALL_MOCKUP_SCENES, SCENES_ASKED_FOR, aiScenes, deterministicScenes, sceneBySlug, scenesInGroup, specCountGap } from "./index";

/**
 * The seeded mockup scenes against `docs/spec/07-template-library.md`'s own table and F-L1's library
 * panel, read line by line rather than remembered. Nothing here checks that 40 scenes exist, because
 * the spec does not name 40: it asks for 40 and names fewer, and `specCountGap` is the finding.
 */

/** Every scene `07`'s table and F-L1's library panel name between them, by its title. */
const NAMED_IN_THE_SPEC: readonly string[] = [
  // 07, "Product shots (deterministic, free)", plus F-L1's 360° turntable.
  "Front render",
  "Back render",
  "Three-quarter render",
  "Side render",
  "Flat lay on white",
  "Flat lay on grass",
  "Hanger on a wall",
  "Folded stack",
  "Ghost mannequin",
  "360° turntable",
  // 07, Teamwear.
  "Kit laid out in a changing room",
  "Kit on a bench",
  "Team line-up, five players",
  "Team line-up, eleven players",
  "Captain holding the shirt",
  "Floodlit pitch at night",
  "Tunnel walk-out",
  // 07, Training & gym.
  "Gym mirror",
  "Warm-up on a track",
  "Stretching on turf",
  "Weights rack",
  // 07, Running.
  "City street run",
  "Trail at dawn",
  "Finish line",
  // 07, Combat.
  "Cage corner",
  "Dojo mat",
  // 07, Esports.
  "Gaming desk with RGB lighting",
  "Stage with screens",
  // 07, Retail, and F-L1's E-commerce list.
  "Shop rail",
  "E-commerce white, square",
  "E-commerce white, 4:5",
  "Studio colour backdrop",
  "Lifestyle model on a studio backdrop",
  "Size-chart card",
  "Colour-chart card",
];

describe("the seeded scenes against the spec", () => {
  it("seeds exactly the scenes 07 and F-L1 name, and no others", () => {
    expect([...ALL_MOCKUP_SCENES.map((scene) => scene.title)].sort()).toEqual([...NAMED_IN_THE_SPEC].sort());
  });

  it("says plainly that the spec asks for more scenes than it names", () => {
    expect(SCENES_ASKED_FOR).toBe(LAUNCH_COUNTS.mockup_scene);
    const gap = specCountGap();
    expect(gap?.ruleId).toBe("R-GAP-000");
    expect(gap?.line).toContain(`asks for ${SCENES_ASKED_FOR} mockup scenes and names ${ALL_MOCKUP_SCENES.length}`);
    expect(specCountGap(Array.from({ length: SCENES_ASKED_FOR }, () => ALL_MOCKUP_SCENES[0]!))).toBeNull();
  });

  it("gives every scene a slug the templates table accepts, and no slug twice", () => {
    const slugs = ALL_MOCKUP_SCENES.map((scene) => scene.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const slug of slugs) expect(slug, slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    for (const slug of slugs) expect(slug.length, slug).toBeLessThanOrEqual(64);
  });

  it("uses only the tags L8's own vocabulary and the database's checks allow", () => {
    for (const scene of ALL_MOCKUP_SCENES) {
      for (const sport of scene.sports) expect(SPORT_TAGS, scene.slug).toContain(sport);
      for (const mood of scene.moods) expect(MOOD_TAGS, scene.slug).toContain(mood);
      expect(scene.moods.length, scene.slug).toBeLessThanOrEqual(4);
      expect(scene.sports.length, scene.slug).toBeLessThanOrEqual(6);
    }
  });

  it("gives every scene between one and eleven garment slots, numbered from one", () => {
    for (const scene of ALL_MOCKUP_SCENES) {
      expect(scene.slots.length, scene.slug).toBeGreaterThanOrEqual(1);
      expect(scene.slots.length, scene.slug).toBeLessThanOrEqual(11);
      expect(scene.slots.map((slot) => slot.index)).toEqual(scene.slots.map((_, at_) => at_ + 1));
    }
  });

  it("keeps every garment slot inside the canvas, because the scene fixes the placement", () => {
    for (const scene of ALL_MOCKUP_SCENES) {
      for (const slot of scene.slots) {
        expect(slot.frame.x, `${scene.slug} ${slot.index}`).toBeGreaterThanOrEqual(0);
        expect(slot.frame.y, `${scene.slug} ${slot.index}`).toBeGreaterThanOrEqual(0);
        expect(slot.frame.x + slot.frame.width, `${scene.slug} ${slot.index}`).toBeLessThanOrEqual(1.0001);
        expect(slot.frame.y + slot.frame.height, `${scene.slug} ${slot.index}`).toBeLessThanOrEqual(1.0001);
      }
    }
  });

  it("names a backdrop we painted ourselves for every scene, and at least one crop", () => {
    const keys = Object.keys(BACKDROPS);
    for (const scene of ALL_MOCKUP_SCENES) {
      expect(keys, scene.slug).toContain(scene.backdrop.key);
      expect(scene.backdrop.note, scene.slug).toContain("not a photograph");
      expect(scene.crops.length, scene.slug).toBeGreaterThanOrEqual(1);
      for (const crop of scene.crops) expect(CROPS).toContain(crop);
    }
  });

  it("marks an eleven-player line-up as the only scene with eleven slots", () => {
    expect(sceneBySlug("team-line-up-eleven")?.slots).toHaveLength(11);
    expect(sceneBySlug("team-line-up-five")?.slots).toHaveLength(5);
    expect(sceneBySlug("nothing-like-this")).toBeNull();
  });
});

describe("which scenes this workstream renders", () => {
  it("renders every product shot and every e-commerce card, and leaves every photographic place to L3", () => {
    expect(deterministicScenes().every((scene) => scene.owner === "L2")).toBe(true);
    expect(aiScenes().every((scene) => scene.owner === "L3")).toBe(true);
    expect(deterministicScenes().length + aiScenes().length).toBe(ALL_MOCKUP_SCENES.length);
    expect(scenesInGroup("product").every((scene) => scene.source === "deterministic")).toBe(true);
    expect(scenesInGroup("teamwear").every((scene) => scene.source === "ai")).toBe(true);
  });

  it("names no model preset at all, because those rows are L3's", () => {
    expect(ALL_MOCKUP_SCENES.every((scene) => scene.modelPresets.length === 0)).toBe(true);
  });

  it("says on every scene that nobody has reviewed it, and says which ones a model runs", () => {
    for (const scene of ALL_MOCKUP_SCENES) {
      expect(scene.note, scene.slug).toContain(SEEDED_SCENE_NOTE);
      expect(scene.ruleId, scene.slug).toBe("R-GAP-000");
      expect(scene.note.includes(FOR_L3_NOTE), scene.slug).toBe(scene.source === "ai");
    }
  });

  it("covers every group of 07 with at least one scene", () => {
    for (const group of SCENE_GROUPS) expect(scenesInGroup(group).length, group).toBeGreaterThan(0);
  });
});

describe("how a scene is written down", () => {
  it("centres a frame and places one by its corner", () => {
    expect(centre(0.5, 0.5)).toEqual({ x: 0.25, y: 0.25, width: 0.5, height: 0.5 });
    expect(at(0.1, 0.2, 0.3, 0.4)).toEqual({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 });
  });

  it("gives a plan all four crops when it names none", () => {
    const scene = sceneOf({
      slug: "plain",
      title: "Plain",
      group: "product",
      source: "deterministic",
      backdrop: "white",
      lighting: "Flat",
      people: "none",
      slots: [{ view: "front", presentation: "flat", pose: "Hero front", camera: "Straight on", frame: centre(0.5, 0.5) }],
      sports: [],
      moods: [],
    });
    expect(scene.crops).toEqual(CROPS);
    expect(scene.card).toBeNull();
    expect(scene.owner).toBe("L2");
  });
});
