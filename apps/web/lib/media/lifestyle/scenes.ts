import type { MediaView } from "../contract";

/**
 * The four lifestyle pictures of a set and the fixed words that ask for them (plan v4, W3-B, decision 0057).
 * Nothing a person types ever reaches a prompt: a prompt is chosen by scene id and is the same text every time.
 */

export const SCENE_IDS = ["pitch", "changing_room", "street", "on_model"] as const;
export type SceneId = (typeof SCENE_IDS)[number];

/**
 * A media item is unique by (set, kind, view) and the contract has one `scene` view, so the three scenes need three
 * different values. `kind` is `lifestyle`, which tells these apart from the studio renders that use `front` and
 * `three_quarter`. Owner question: add scene names to the contract.
 */
export const SCENE_VIEWS: Readonly<Record<SceneId, MediaView>> = {
  pitch: "scene",
  changing_room: "three_quarter",
  street: "front",
  on_model: "on_model",
};

export const SCENE_LABELS: Readonly<Record<SceneId, string>> = {
  pitch: "On the pitch",
  changing_room: "In the changing room",
  street: "On the street",
  on_model: "On a model",
};

const KEEP =
  "Keep the garment exactly as it is in the reference picture: the same shape, colours, panels, seams, stripes, crest, sponsor logos, names and numbers, in the same place and at the same size. Do not add, remove, redraw or restyle any logo, text or number. Change only what is around the garment.";

const SCENES: Readonly<Record<SceneId, string>> = {
  pitch: "Place the garment on the grass of a sports pitch at golden hour, soft light, shallow depth of field, a goal in the far background.",
  changing_room: "Place the garment hanging on a peg in a clean sports changing room with wooden benches and lockers, warm even light.",
  street: "Place the garment in an urban street setting with a blurred city background in daylight, as in a product photograph.",
  on_model: "Show the garment worn by a person standing in a neutral studio, facing the camera, the garment unchanged and fully visible.",
};

export const promptFor = (scene: SceneId): string => `${SCENES[scene]} ${KEEP}`;
