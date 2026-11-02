import { centre, slot, type ScenePlan } from "./build";

/**
 * `07`'s four lifestyle groups:
 *
 *   Training & gym: gym mirror · warm-up on a track · stretching on turf · weights rack
 *   Running:        city street run · trail at dawn · finish line
 *   Combat:         cage / ring corner · dojo mat
 *   Esports:        gaming desk with RGB lighting · stage with screens
 *
 * Every one is a photographic place with a person in it, so every one is an **AI scene** L3 runs.
 * They are rows here so the library is whole and so a filter can find them; this workstream calls
 * no model and renders a labelled placeholder for each.
 */

const plan = (
  slug: string,
  title: string,
  group: ScenePlan["group"],
  backdrop: string,
  lighting: string,
  pose: string,
  camera: string,
  people: ScenePlan["people"],
  sports: readonly string[],
  moods: readonly string[],
): ScenePlan => ({
  slug,
  title,
  group,
  source: "ai",
  backdrop,
  lighting,
  people,
  slots: [slot("front", "worn", pose, camera, centre(0.46, 0.62))],
  sports,
  moods,
});

const TRAINING = ["training", "running-gym"];
const RUNNING = ["running-gym"];
const COMBAT = ["combat"];
const ESPORTS = ["esports"];

export const LIFESTYLE_SCENES: readonly ScenePlan[] = [
  plan("gym-mirror", "Gym mirror", "training", "interior", "Mixed gym light, mirror behind", "Arms crossed", "Eye level, straight on", "one", TRAINING, ["sharp"]),
  plan("track-warm-up", "Warm-up on a track", "training", "outfield", "Open daylight", "Running stride", "Low angle", "one", TRAINING, ["bold"]),
  plan("turf-stretch", "Stretching on turf", "training", "outfield", "Open daylight", "Mid-stretch", "Eye level, from the side", "one", TRAINING, ["clean"]),
  plan("weights-rack", "Weights rack", "training", "interior", "Hard side light", "Arms crossed", "Eye level, straight on", "one", TRAINING, ["sharp"]),
  plan("city-street-run", "City street run", "running", "interior", "Overcast city light", "Running stride", "Eye level, panning", "one", RUNNING, ["bold", "sharp"]),
  plan("trail-at-dawn", "Trail at dawn", "running", "night", "First light, low sun behind", "Running stride", "Low angle", "one", RUNNING, ["understated", "bold"]),
  plan("finish-line", "Finish line", "running", "outfield", "Open daylight", "Arms up at the line", "Eye level, straight on", "one", RUNNING, ["bold"]),
  plan("cage-corner", "Cage corner", "combat", "night", "Hard spot from above", "Arms crossed", "Low angle", "one", COMBAT, ["bold", "sharp"]),
  plan("dojo-mat", "Dojo mat", "combat", "interior", "Even hall light", "Standing guard", "Eye level, straight on", "one", COMBAT, ["understated", "sharp"]),
  plan("rgb-desk", "Gaming desk with RGB lighting", "esports", "night", "Screen glow and RGB strips", "Seated at the desk", "Eye level, from behind the screen", "one", ESPORTS, ["bold", "playful"]),
  plan("stage-with-screens", "Stage with screens", "esports", "night", "Stage wash and screen light", "Arms crossed", "Low angle", "team", ESPORTS, ["bold", "sharp"]),
];
