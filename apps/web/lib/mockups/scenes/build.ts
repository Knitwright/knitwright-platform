import { backdropFor } from "../backdrops";
import { CROPS, MOCKUP_GAP_RULE, type ChartCard, type Crop, type GarmentSlot, type GarmentView, type MockupScene, type PeopleBand, type Presentation, type SceneGroup, type SceneSource, type SlotFrame } from "../types";

/**
 * How a seeded mockup scene is written down (plan v5 L2; spec `07-template-library.md`).
 *
 * A plan is the short form a scene is written in; `sceneOf` turns it into the `MockupScene` a row
 * holds. The scene files beside this one hold nothing but plans, so the list of scenes reads as a
 * table and can be checked against `07` line by line.
 *
 * Two facts every plan carries without saying them:
 *
 *   * **no rulebook entry covers the mockup studio**, so every scene's `ruleId` is `R-GAP-000` and
 *     the pull request lists it;
 *   * **a scene is never reviewed by anybody**, so every note says so. Nothing here reads as
 *     settled, and no scene claims a model preset: the presets a generated scene may use are L3's
 *     own rows (`model_presets`), and naming one here would be inventing it.
 */

/** The words every seeded scene carries, so nobody reads a seeded scene as a reviewed one. */
export const SEEDED_SCENE_NOTE = "Seeded from docs/spec/07-template-library.md and F-L1. Not reviewed by anyone.";

/** The one sentence a generated scene adds: this workstream carries it but does not run it. */
export const FOR_L3_NOTE = "An AI scene: the model changes the light, the place and the pose, never the garment. Run by workstream L3, which is not built yet.";

/** A rectangle on the scene canvas, as a fraction of it. */
export const at = (x: number, y: number, width: number, height: number): SlotFrame => ({ x, y, width, height });

/** A rectangle of this size in the middle of the canvas. */
export const centre = (width: number, height: number): SlotFrame => at((1 - width) / 2, (1 - height) / 2, width, height);

interface SlotPlan {
  readonly view: GarmentView;
  readonly presentation: Presentation;
  readonly pose: string;
  readonly camera: string;
  readonly frame: SlotFrame;
}

/** One garment in a scene, in the short form the scene files use. */
export const slot = (view: GarmentView, presentation: Presentation, pose: string, camera: string, frame: SlotFrame): SlotPlan => ({ view, presentation, pose, camera, frame });

export interface ScenePlan {
  readonly slug: string;
  readonly title: string;
  readonly group: SceneGroup;
  readonly source: SceneSource;
  readonly backdrop: string;
  readonly lighting: string;
  readonly people: PeopleBand;
  readonly slots: readonly SlotPlan[];
  readonly sports: readonly string[];
  readonly moods: readonly string[];
  /** The crops this scene is cut to. Left out: all four of `07`. */
  readonly crops?: readonly Crop[];
  /** A chart card rather than a garment. Only the two cards F-L1 names use it. */
  readonly card?: ChartCard;
}

/** The scene a plan describes, with the gap rule and the seeded note every scene carries. */
export function sceneOf(plan: ScenePlan): MockupScene {
  const slots: readonly GarmentSlot[] = plan.slots.map((one, index) => ({ index: index + 1, ...one }));
  return {
    slug: plan.slug,
    title: plan.title,
    group: plan.group,
    source: plan.source,
    slots,
    backdrop: backdropFor(plan.backdrop),
    lighting: plan.lighting,
    crops: plan.crops ?? CROPS,
    people: plan.people,
    sports: plan.sports,
    moods: plan.moods,
    // The presets a generated scene may use are L3's rows. Naming one here would be inventing it.
    modelPresets: [],
    card: plan.card ?? null,
    owner: plan.source === "deterministic" ? "L2" : "L3",
    ruleId: MOCKUP_GAP_RULE,
    note: plan.source === "deterministic" ? SEEDED_SCENE_NOTE : `${SEEDED_SCENE_NOTE} ${FOR_L3_NOTE}`,
  };
}

/** Every plan of a file, as scenes. */
export const scenesOf = (plans: readonly ScenePlan[]): readonly MockupScene[] => plans.map(sceneOf);
