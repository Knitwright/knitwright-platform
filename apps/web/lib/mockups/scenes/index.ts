import { LAUNCH_COUNTS } from "@/lib/templates/kinds";
import { MOCKUP_GAP_RULE, type MockupScene, type SceneGap, type SceneGroup } from "../types";
import { scenesOf } from "./build";
import { LIFESTYLE_SCENES } from "./lifestyle";
import { PRODUCT_SCENES } from "./product";
import { RETAIL_SCENES } from "./retail";
import { TEAMWEAR_SCENES } from "./teamwear";

/**
 * Every mockup scene the library is seeded with, in the order `07`'s own table lists them.
 *
 * **The spec's own table is short of its own count, and this file does not make the difference up.**
 * `07` gives mockup scenes a launch count of 40 and then names fewer than that in the table beneath
 * it; F-L1's library panel names two more (the size-chart and colour-chart cards) and the 360°
 * turntable. The union of both lists is what is seeded here, scene for scene, and
 * `SPEC_COUNT_GAP` carries the difference with `R-GAP-000` so a screen can say it rather than a
 * reader counting rows and wondering. Inventing scenes to reach 40 would be inventing content the
 * spec does not contain.
 */
export const ALL_MOCKUP_SCENES: readonly MockupScene[] = scenesOf([...PRODUCT_SCENES, ...TEAMWEAR_SCENES, ...LIFESTYLE_SCENES, ...RETAIL_SCENES]);

/** What `07` asks the library to hold, read from L8's own table rather than written again here. */
export const SCENES_ASKED_FOR = LAUNCH_COUNTS.mockup_scene;

/** The scenes this workstream renders now: the deterministic half of F-L1. */
export const deterministicScenes = (): readonly MockupScene[] => ALL_MOCKUP_SCENES.filter((scene) => scene.source === "deterministic");

/** The scenes a model runs, carried here as rows and marked for L3. */
export const aiScenes = (): readonly MockupScene[] => ALL_MOCKUP_SCENES.filter((scene) => scene.source === "ai");

export const sceneBySlug = (slug: string): MockupScene | null => ALL_MOCKUP_SCENES.find((scene) => scene.slug === slug) ?? null;

export const scenesInGroup = (group: SceneGroup): readonly MockupScene[] => ALL_MOCKUP_SCENES.filter((scene) => scene.group === group);

/**
 * The difference between the count `07` asks for and the scenes `07` and F-L1 actually name, or null
 * when they agree. A screen shows this instead of looking as though the library is whole.
 */
export function specCountGap(scenes: readonly MockupScene[] = ALL_MOCKUP_SCENES): SceneGap | null {
  const short = SCENES_ASKED_FOR - scenes.length;
  if (short <= 0) return null;
  return {
    ruleId: MOCKUP_GAP_RULE,
    line: `docs/spec/07-template-library.md asks for ${SCENES_ASKED_FOR} mockup scenes and names ${scenes.length} between its own table and F-L1's library panel. The other ${short} are not written down anywhere, so they are not seeded.`,
  };
}
