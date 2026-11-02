import { describe, expect, it } from "vitest";
import { aiScenes, sceneBySlug } from "@/lib/mockups";
import {
  ALL_SHOOT_POSES,
  OVER_SHOULDER_NOTE,
  SPEC_POSE_LABELS,
  cameraByKey,
  poseByKey,
  posesOf,
  presetKey,
  presetsOfScene,
  shootPoseRows,
} from "./poses";
import { SHOOT_GAP_RULE } from "./types";

/**
 * The pose and camera rows against their two sources. Nothing here may be a list somebody typed
 * out: a row is either one of F-L1's five poses or a pose or camera a seeded scene already names.
 */

describe("the pose and camera presets", () => {
  it("hold F-L1's five poses, in the spec's own order, marked as the spec's", () => {
    const spec = posesOf("pose").filter((row) => row.source === "spec");
    expect(spec.map((row) => row.label)).toEqual([...SPEC_POSE_LABELS]);
  });

  it("hold every pose and camera the twenty AI scenes name, and nothing else", () => {
    const fromScenes = new Set(aiScenes().flatMap((scene) => scene.slots.flatMap((slot) => [presetKey(slot.pose), presetKey(slot.camera)])));
    const specKeys = new Set(SPEC_POSE_LABELS.map(presetKey));
    for (const row of ALL_SHOOT_POSES) {
      expect(fromScenes.has(row.key) || specKeys.has(row.key), row.key).toBe(true);
    }
    for (const key of fromScenes) {
      expect(ALL_SHOOT_POSES.some((row) => row.key === key), key).toBe(true);
    }
  });

  it("offer cameras, all of them taken from the scenes, because the spec names no camera list", () => {
    const cameras = posesOf("camera");
    expect(cameras.length).toBeGreaterThan(0);
    for (const camera of cameras) expect(camera.source).toBe("scene");
    expect(cameraByKey("eye-level-straight-on")).not.toBeNull();
  });

  it("ask for a person only where a pose means one", () => {
    expect(poseByKey("running-stride")!.needsPerson).toBe(true);
    expect(poseByKey("laid-out-on-the-bench")!.needsPerson).toBe(false);
    expect(poseByKey("folded-on-the-bench")!.needsPerson).toBe(false);
    expect(poseByKey("hung-on-the-rail")!.needsPerson).toBe(false);
  });

  it("carry the preset's own words as the prompt, and no scene direction of our own", () => {
    for (const row of ALL_SHOOT_POSES) {
      expect(row.prompt).toBe(`${row.label}.`);
      expect(row.ruleId).toBe(SHOOT_GAP_RULE);
      expect(row.note).toMatch(/Not reviewed by anyone/);
    }
  });

  it("keep the spec's row where a scene happens to name the same words", () => {
    expect(poseByKey("arms-crossed")!.source).toBe("spec");
    expect(poseByKey("ball-at-feet")!.source).toBe("spec");
  });

  it("carry what F-L1 says in brackets about the back view, rather than dropping it", () => {
    expect(OVER_SHOULDER_NOTE).toMatch(/name and number/);
  });

  it("answer nothing for a key nothing has, and never mix a pose up with a camera", () => {
    expect(poseByKey("eye-level-straight-on")).toBeNull();
    expect(cameraByKey("running-stride")).toBeNull();
    expect(poseByKey("")).toBeNull();
  });

  it("make a key out of any words, bounded", () => {
    expect(presetKey("Eye level, from behind the screen")).toBe("eye-level-from-behind-the-screen");
    expect(presetKey("  Hero  front ")).toBe("hero-front");
    expect(presetKey("x".repeat(100)).length).toBe(64);
  });

  it("builds nothing from no scenes but the spec's own five", () => {
    expect(shootPoseRows([]).map((row) => row.label)).toEqual([...SPEC_POSE_LABELS]);
  });
});

describe("the presets of one scene", () => {
  it("are the poses and cameras that scene's own slots name, in slot order, without repeats", () => {
    const scene = sceneBySlug("changing-room-kit-layout")!;
    const presets = presetsOfScene(scene);
    expect(presets.poses).toEqual(["laid-out-on-the-bench"]);
    expect(presets.cameras).toEqual(["straight-down-from-above"]);
  });

  it("leave out a preset no row exists for", () => {
    const scene = sceneBySlug("floodlit-pitch")!;
    expect(presetsOfScene(scene, []).poses).toEqual([]);
    expect(presetsOfScene(scene, []).cameras).toEqual([]);
  });
});
