import { aiScenes, sceneBySlug, type MockupScene, type SceneGroup } from "@/lib/mockups";
import { MODEL_PRESET_KEYS } from "./models";
import { presetsOfScene, SPEC_POSE_LABELS, presetKey } from "./poses";
import { SEEDED_NOTE, SHOOT_GAP_RULE, type ShootConcept, type ShootGap, type ShootStyle } from "./types";

/**
 * THE SHOOT IDEAS LIBRARY (spec F-L1: "**Shoot ideas library:** the predefined concepts in
 * `07-template-library.md`. Each concept bundles scene, lighting, camera, 3–6 poses, model presets
 * and an output set"; plan v5 L3: "Shoot ideas library (12 concepts from `07`)").
 *
 * **What the spec actually contains, and what it does not.** `07` has no table of shoot concepts.
 * What it has is a table of **mockup scenes**, 20 of which are photographic and so L3's, and those
 * 20 are already rows -- L2 seeded them as `templates` of kind `mockup_scene` and marked each one
 * `owner: "L3"`. So a concept here is a **bundle of those rows**, one per place a person would shoot
 * in, and the 12 of them cover all 20 scenes with none left out and none counted twice
 * (`sceneCoverage` proves it in a test). Nothing invents a scene, a place or a light: every field
 * below either names a scene row or is read off one.
 *
 * Three things `07` does not say, carried as gaps rather than filled in quietly:
 *
 *   * **how many poses a concept has.** `07` says 3 to 6; a concept whose scenes show a garment
 *     with nobody in it names one or two and the rest are nowhere written down (`conceptGap`).
 *   * **which style a concept uses.** The five styles are F-L1's; which one belongs to which place
 *     is nobody's decision yet, so `STYLE_OF_GROUP` is a labelled Knitwright default and says so.
 *   * **what an "output set" is.** F-L1's own acceptance test is the only number anywhere near it
 *     ("From a shoot idea: 4 AI images in under 3 minutes"), so a concept asks for four pictures at
 *     the scene's own shape.
 */

/** F-L1's acceptance test is the only count the spec gives a shoot: four pictures from an idea. */
export const CONCEPT_IMAGE_COUNT = 4;

/** Which of F-L1's five styles a group's concepts start at. A Knitwright default, not the spec's. */
export const STYLE_OF_GROUP: Readonly<Record<SceneGroup, ShootStyle>> = {
  product: "clean-ecom",
  teamwear: "matchday-flash",
  training: "gritty-training",
  running: "gritty-training",
  combat: "matchday-flash",
  esports: "retro-film",
  retail: "clean-ecom",
};

export const STYLE_IS_OURS =
  "Knitwright placeholder: F-L1 names the five styles and nobody has said which one belongs to which shoot, so this is the style the shoot starts at and a person can change it.";

/** `07` asks each concept for three to six poses (`07`, "Each scene defines"). */
export const POSES_ASKED_FOR = { min: 3, max: 6 } as const;

interface ConceptPlan {
  readonly slug: string;
  readonly title: string;
  readonly lead: string;
  readonly sceneSlugs: readonly string[];
}

/**
 * The twelve, in the order `07`'s own scene table runs: teamwear, then training and gym, running,
 * combat, esports and retail. Each `lead` says what the shoot is, in the scene's own words.
 */
export const CONCEPT_PLANS: readonly ConceptPlan[] = [
  {
    slug: "kit-in-the-changing-room",
    title: "Kit in the changing room",
    lead: "The kit laid out before anyone arrives, and folded on the bench. Nobody is in the picture.",
    sceneSlugs: ["changing-room-kit-layout", "kit-on-a-bench"],
  },
  {
    slug: "team-line-up",
    title: "Team line-up",
    lead: "The whole squad in a row, five or eleven shirts, each one its own garment slot.",
    sceneSlugs: ["team-line-up-five", "team-line-up-eleven"],
  },
  {
    slug: "captain-holding-the-shirt",
    title: "Captain holding the shirt",
    lead: "One player holding the shirt up to the camera, late afternoon on the pitch.",
    sceneSlugs: ["captain-holding-shirt"],
  },
  {
    slug: "floodlit-pitch",
    title: "Floodlit pitch at night",
    lead: "Under the floodlights with the ball at their feet.",
    sceneSlugs: ["floodlit-pitch"],
  },
  {
    slug: "tunnel-walk-out",
    title: "Tunnel walk-out",
    lead: "Walking out of the tunnel, the bright mouth of it behind them.",
    sceneSlugs: ["tunnel-walk-out"],
  },
  {
    slug: "gym-session",
    title: "Gym session",
    lead: "In the gym: at the mirror and at the weights rack, hard side light.",
    sceneSlugs: ["gym-mirror", "weights-rack"],
  },
  {
    slug: "warm-up-on-the-track",
    title: "Warm-up on the track",
    lead: "Warming up on the track and stretching on the turf, in open daylight.",
    sceneSlugs: ["track-warm-up", "turf-stretch"],
  },
  {
    slug: "city-street-run",
    title: "City street run",
    lead: "Running through the city under overcast light, the camera panning alongside.",
    sceneSlugs: ["city-street-run"],
  },
  {
    slug: "trail-and-finish-line",
    title: "Trail and finish line",
    lead: "First light on the trail, and arms up at the line.",
    sceneSlugs: ["trail-at-dawn", "finish-line"],
  },
  {
    slug: "cage-and-mat",
    title: "Cage corner and dojo mat",
    lead: "In the corner of the cage under a hard spot, and on the mat in even hall light.",
    sceneSlugs: ["cage-corner", "dojo-mat"],
  },
  {
    slug: "esports-stage-and-desk",
    title: "Esports stage and desk",
    lead: "At the desk in the glow of the screens, and on stage under the wash.",
    sceneSlugs: ["rgb-desk", "stage-with-screens"],
  },
  {
    slug: "retail-and-lifestyle",
    title: "Shop rail and studio backdrop",
    lead: "On the rail under shop spots, and worn on a seamless studio backdrop.",
    sceneSlugs: ["shop-rail", "lifestyle-model-studio-backdrop"],
  },
];

const scenesOfPlan = (plan: ConceptPlan, lookup: (slug: string) => MockupScene | null): readonly MockupScene[] =>
  plan.sceneSlugs.flatMap((slug) => {
    const scene = lookup(slug);
    return scene === null ? [] : [scene];
  });

/** A concept's poses: the ones its scenes name, then F-L1's five when a person is in the picture. */
function posesOfPlan(scenes: readonly MockupScene[], needsModel: boolean): readonly string[] {
  const fromScenes = scenes.flatMap((scene) => presetsOfScene(scene).poses);
  const spec = needsModel ? SPEC_POSE_LABELS.map(presetKey) : [];
  return [...new Set([...fromScenes, ...spec])].slice(0, POSES_ASKED_FOR.max);
}

const camerasOfPlan = (scenes: readonly MockupScene[]): readonly string[] => [
  ...new Set(scenes.flatMap((scene) => presetsOfScene(scene).cameras)),
];

/** The scene a concept's own fields are read off: its first, which is the one its card shows. */
const leadScene = (scenes: readonly MockupScene[]): MockupScene | null => scenes[0] ?? null;

/** The concept a plan describes, every field of it read off the scene rows the plan names. */
export function conceptOf(plan: ConceptPlan, lookup: (slug: string) => MockupScene | null = sceneBySlug): ShootConcept | null {
  const scenes = scenesOfPlan(plan, lookup);
  const first = leadScene(scenes);
  if (first === null) return null;
  const needsModel = scenes.some((scene) => scene.people !== "none");
  return {
    slug: plan.slug,
    title: plan.title,
    lead: plan.lead,
    sceneSlugs: scenes.map((scene) => scene.slug),
    lighting: first.lighting,
    cameraKeys: camerasOfPlan(scenes),
    poseKeys: posesOfPlan(scenes, needsModel),
    modelPresetKeys: needsModel ? MODEL_PRESET_KEYS : [],
    style: STYLE_OF_GROUP[first.group],
    outputs: { count: CONCEPT_IMAGE_COUNT, aspects: ["match"] },
    needsModel,
    sports: [...new Set(scenes.flatMap((scene) => scene.sports))],
    moods: [...new Set(scenes.flatMap((scene) => scene.moods))],
    ruleId: SHOOT_GAP_RULE,
    note: `${SEEDED_NOTE} ${STYLE_IS_OURS}`,
  };
}

export const ALL_SHOOT_CONCEPTS: readonly ShootConcept[] = CONCEPT_PLANS.flatMap((plan) => {
  const concept = conceptOf(plan);
  return concept === null ? [] : [concept];
});

export const conceptBySlug = (slug: string, concepts: readonly ShootConcept[] = ALL_SHOOT_CONCEPTS): ShootConcept | null =>
  concepts.find((concept) => concept.slug === slug) ?? null;

/** The concept that shoots a scene, or null. A board opened from a scene finds its concept this way. */
export const conceptOfScene = (sceneSlug: string, concepts: readonly ShootConcept[] = ALL_SHOOT_CONCEPTS): ShootConcept | null =>
  concepts.find((concept) => concept.sceneSlugs.includes(sceneSlug)) ?? null;

/** Which AI scenes the concepts cover and which they miss, so a test can hold the two lists level. */
export function sceneCoverage(
  concepts: readonly ShootConcept[] = ALL_SHOOT_CONCEPTS,
  scenes: readonly MockupScene[] = aiScenes(),
): Readonly<{ covered: readonly string[]; missed: readonly string[]; twice: readonly string[] }> {
  const counted = new Map<string, number>();
  for (const concept of concepts) for (const slug of concept.sceneSlugs) counted.set(slug, (counted.get(slug) ?? 0) + 1);
  const all = scenes.map((scene) => scene.slug);
  return {
    covered: all.filter((slug) => (counted.get(slug) ?? 0) > 0),
    missed: all.filter((slug) => (counted.get(slug) ?? 0) === 0),
    twice: [...counted.entries()].filter(([, count]) => count > 1).map(([slug]) => slug),
  };
}

/**
 * What this concept cannot say yet, in the words a card shows. Today that is only the pose count:
 * a shoot of a garment with nobody in it names the one or two poses its scenes name, and `07` asks
 * for three.
 */
export function conceptGap(concept: ShootConcept): ShootGap | null {
  if (concept.poseKeys.length >= POSES_ASKED_FOR.min) return null;
  return {
    ruleId: concept.ruleId,
    line: `docs/spec/07-template-library.md asks each shoot for ${POSES_ASKED_FOR.min} to ${POSES_ASKED_FOR.max} poses and the scenes of this one name ${concept.poseKeys.length}. The others are not written down anywhere, so they are not seeded.`,
  };
}
