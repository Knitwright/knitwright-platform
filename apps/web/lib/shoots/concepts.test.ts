import { describe, expect, it } from "vitest";
import { aiScenes, sceneBySlug, type MockupScene } from "@/lib/mockups";
import {
  ALL_SHOOT_CONCEPTS,
  CONCEPT_IMAGE_COUNT,
  CONCEPT_PLANS,
  POSES_ASKED_FOR,
  STYLE_OF_GROUP,
  conceptBySlug,
  conceptGap,
  conceptOf,
  conceptOfScene,
  sceneCoverage,
} from "./concepts";
import { MODEL_PRESET_KEYS } from "./models";
import { ALL_SHOOT_POSES } from "./poses";
import { SHOOT_GAP_RULE, SHOOT_STYLES } from "./types";

/**
 * The shoot ideas library against the two documents it is made of: `07`'s scene table, which L2
 * seeded as rows, and F-L1's own lists. The test that matters most is the coverage one: the twelve
 * concepts have to account for all twenty of the AI scenes, because a scene no concept names is a
 * scene nobody can shoot.
 */

describe("the twelve shoot ideas", () => {
  it("are twelve, as the plan asks", () => {
    expect(ALL_SHOOT_CONCEPTS).toHaveLength(12);
    expect(CONCEPT_PLANS).toHaveLength(12);
  });

  it("name every one of the twenty AI scenes L2 marked for this workstream, once each", () => {
    const coverage = sceneCoverage();
    expect(aiScenes()).toHaveLength(20);
    expect(coverage.missed).toEqual([]);
    expect(coverage.twice).toEqual([]);
    expect(coverage.covered).toHaveLength(20);
  });

  it("name only scenes a model runs, never one the platform draws itself", () => {
    for (const concept of ALL_SHOOT_CONCEPTS) {
      for (const slug of concept.sceneSlugs) {
        const scene = sceneBySlug(slug);
        expect(scene, slug).not.toBeNull();
        expect(scene!.source, slug).toBe("ai");
        expect(scene!.owner, slug).toBe("L3");
      }
    }
  });

  it("read their light, their sports and their moods off the scene rows rather than writing their own", () => {
    for (const concept of ALL_SHOOT_CONCEPTS) {
      const scenes = concept.sceneSlugs.map((slug) => sceneBySlug(slug)!);
      expect(concept.lighting).toBe(scenes[0]!.lighting);
      for (const sport of concept.sports) expect(scenes.some((scene) => scene.sports.includes(sport))).toBe(true);
      for (const mood of concept.moods) expect(scenes.some((scene) => scene.moods.includes(mood))).toBe(true);
    }
  });

  it("offer only poses and cameras that exist as rows", () => {
    for (const concept of ALL_SHOOT_CONCEPTS) {
      for (const key of concept.poseKeys) {
        expect(ALL_SHOOT_POSES.some((row) => row.kind === "pose" && row.key === key), `${concept.slug}: ${key}`).toBe(true);
      }
      for (const key of concept.cameraKeys) {
        expect(ALL_SHOOT_POSES.some((row) => row.kind === "camera" && row.key === key), `${concept.slug}: ${key}`).toBe(true);
      }
      expect(concept.poseKeys.length).toBeLessThanOrEqual(POSES_ASKED_FOR.max);
      expect(concept.cameraKeys.length).toBeGreaterThan(0);
    }
  });

  it("ask for a model only where the scene has a person in it, and then for the licensed presets", () => {
    for (const concept of ALL_SHOOT_CONCEPTS) {
      const people = concept.sceneSlugs.some((slug) => sceneBySlug(slug)!.people !== "none");
      expect(concept.needsModel, concept.slug).toBe(people);
      expect(concept.modelPresetKeys, concept.slug).toEqual(people ? MODEL_PRESET_KEYS : []);
    }
  });

  it("ask for the four pictures F-L1's own acceptance test asks a shoot idea for", () => {
    expect(CONCEPT_IMAGE_COUNT).toBe(4);
    for (const concept of ALL_SHOOT_CONCEPTS) {
      expect(concept.outputs.count).toBe(4);
      expect(concept.outputs.aspects).toEqual(["match"]);
    }
  });

  it("carry a style F-L1 names, and say in their note that the choice is ours and not the spec's", () => {
    for (const concept of ALL_SHOOT_CONCEPTS) {
      expect(SHOOT_STYLES).toContain(concept.style);
      expect(concept.note).toMatch(/Not reviewed by anyone/);
      expect(concept.note).toMatch(/Knitwright placeholder/);
      expect(concept.ruleId).toBe(SHOOT_GAP_RULE);
    }
  });

  it("file each group under the style the mapping gives it", () => {
    const teamwear = conceptBySlug("tunnel-walk-out")!;
    expect(teamwear.style).toBe(STYLE_OF_GROUP.teamwear);
    expect(conceptBySlug("gym-session")!.style).toBe(STYLE_OF_GROUP.training);
    expect(conceptBySlug("esports-stage-and-desk")!.style).toBe(STYLE_OF_GROUP.esports);
  });

  it("are found by their slug and by any scene they shoot", () => {
    expect(conceptBySlug("team-line-up")!.title).toBe("Team line-up");
    expect(conceptBySlug("not-a-concept")).toBeNull();
    expect(conceptOfScene("team-line-up-eleven")!.slug).toBe("team-line-up");
    expect(conceptOfScene("product-front")).toBeNull();
  });

  it("are left out entirely when the scene rows they name have gone, rather than shown half-made", () => {
    expect(conceptOf(CONCEPT_PLANS[0]!, () => null)).toBeNull();
  });

  it("drop a scene that has gone and keep the rest", () => {
    const plan = CONCEPT_PLANS[0]!;
    const only = (slug: string): MockupScene | null => (slug === plan.sceneSlugs[0] ? sceneBySlug(slug) : null);
    const concept = conceptOf(plan, only)!;
    expect(concept.sceneSlugs).toEqual([plan.sceneSlugs[0]]);
  });
});

describe("what a concept cannot say yet", () => {
  it("says so when its scenes name fewer poses than 07 asks for, with the gap rule on it", () => {
    const garmentOnly = conceptBySlug("kit-in-the-changing-room")!;
    expect(garmentOnly.needsModel).toBe(false);
    const gap = conceptGap(garmentOnly);
    expect(gap).not.toBeNull();
    expect(gap!.ruleId).toBe(SHOOT_GAP_RULE);
    expect(gap!.line).toMatch(/07-template-library\.md asks each shoot for 3 to 6 poses/);
  });

  it("says nothing for a concept with a person in it, which has F-L1's five", () => {
    const withPeople = conceptBySlug("team-line-up")!;
    expect(withPeople.poseKeys.length).toBeGreaterThanOrEqual(POSES_ASKED_FOR.min);
    expect(conceptGap(withPeople)).toBeNull();
  });
});
