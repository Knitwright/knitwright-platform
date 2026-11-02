import { aiScenes, type MockupScene } from "@/lib/mockups";
import { PRESET_SOURCES, SEEDED_NOTE, SHOOT_GAP_RULE, type PoseKind, type ShootPose } from "./types";

/**
 * THE POSE AND CAMERA PRESETS (spec F-L1: "**Pose** and **Camera** presets: Hero front, Running
 * stride, Arms crossed, Ball at feet, Over-shoulder back (shows name and number)"; `07`: a scene
 * defines "garment slots (1–11), each with a pose and camera").
 *
 * **Nothing here is invented, and nothing here is a literal list somebody typed out.** There are
 * two sources and the row says which it came from:
 *
 *   * `spec` -- the five poses F-L1 names by name;
 *   * `scene` -- every pose and camera the 20 AI scenes L2 seeded already name in their own slots
 *     (`lib/mockups/scenes/**`). A camera preset has no other source: the spec gives the picker's
 *     name and leaves the list to the scenes, so the scenes are the list.
 *
 * A pose derived from a scene inherits that scene's people band, so "laid out on the bench" does
 * not ask for a person and "running stride" does. That matters for money: a shoot that needs nobody
 * in the picture needs no model preset and so no licence, and `verdict.ts` reads this field to say
 * so.
 */

/** F-L1's own five, in the order the spec prints them. The only pose words this file writes down. */
export const SPEC_POSE_LABELS: readonly string[] = [
  "Hero front",
  "Running stride",
  "Arms crossed",
  "Ball at feet",
  "Over-shoulder back",
];

/** What F-L1 says in brackets after the last of them, carried onto the card rather than dropped. */
export const OVER_SHOULDER_NOTE = "Shows the name and number on the back.";

/** `hero-front` from `Hero front`: the key a row is found by and a board stores. */
export const presetKey = (label: string): string =>
  label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);

const poseRow = (label: string, kind: PoseKind, needsPerson: boolean, source: (typeof PRESET_SOURCES)[number]): ShootPose => ({
  key: presetKey(label),
  kind,
  label,
  // The prompt is the preset's own words. A sentence of our own here would be a scene direction
  // nobody wrote down; the scene and the spec wrote these.
  prompt: label.endsWith(".") ? label : `${label}.`,
  needsPerson,
  source,
  ruleId: SHOOT_GAP_RULE,
  note: source === "spec" ? SEEDED_NOTE : `${SEEDED_NOTE} Taken from the scene that names it.`,
});

/** Every pose and camera the AI scenes name, in the order the scenes are seeded. */
function fromScenes(scenes: readonly MockupScene[]): readonly ShootPose[] {
  const rows = new Map<string, ShootPose>();
  for (const scene of scenes) {
    for (const slot of scene.slots) {
      const pose = poseRow(slot.pose, "pose", scene.people !== "none", "scene");
      const camera = poseRow(slot.camera, "camera", false, "scene");
      if (!rows.has(`pose:${pose.key}`)) rows.set(`pose:${pose.key}`, pose);
      if (!rows.has(`camera:${camera.key}`)) rows.set(`camera:${camera.key}`, camera);
    }
  }
  return [...rows.values()];
}

/**
 * Every pose and camera row, spec poses first. A spec pose a scene also names keeps the spec's own
 * row, because the spec is the stronger source: the scene found the same words by chance.
 */
export function shootPoseRows(scenes: readonly MockupScene[] = aiScenes()): readonly ShootPose[] {
  const spec = SPEC_POSE_LABELS.map((label) => poseRow(label, "pose", true, "spec"));
  const taken = new Set(spec.map((row) => `pose:${row.key}`));
  return [...spec, ...fromScenes(scenes).filter((row) => !taken.has(`${row.kind}:${row.key}`))];
}

export const ALL_SHOOT_POSES: readonly ShootPose[] = shootPoseRows();

export const posesOf = (kind: PoseKind, rows: readonly ShootPose[] = ALL_SHOOT_POSES): readonly ShootPose[] =>
  rows.filter((row) => row.kind === kind);

export const poseByKey = (key: string, rows: readonly ShootPose[] = ALL_SHOOT_POSES): ShootPose | null =>
  rows.find((row) => row.kind === "pose" && row.key === key) ?? null;

export const cameraByKey = (key: string, rows: readonly ShootPose[] = ALL_SHOOT_POSES): ShootPose | null =>
  rows.find((row) => row.kind === "camera" && row.key === key) ?? null;

/** The poses and cameras one scene names, in slot order. Used to build a concept's own lists. */
export function presetsOfScene(scene: MockupScene, rows: readonly ShootPose[] = ALL_SHOOT_POSES): Readonly<{ poses: readonly string[]; cameras: readonly string[] }> {
  const poses: string[] = [];
  const cameras: string[] = [];
  for (const slot of scene.slots) {
    const pose = presetKey(slot.pose);
    const camera = presetKey(slot.camera);
    if (rows.some((row) => row.kind === "pose" && row.key === pose) && !poses.includes(pose)) poses.push(pose);
    if (rows.some((row) => row.kind === "camera" && row.key === camera) && !cameras.includes(camera)) cameras.push(camera);
  }
  return { poses, cameras };
}
