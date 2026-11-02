/**
 * THE SHOOT STUDIO'S OWN VOCABULARY (plan v5 wave 4 L3; spec F-L1's AI half; decision 0093).
 *
 * A shoot puts a garment the platform **drew** into a place a model **lights**. Everything in this
 * directory follows from one rule, which the spec states twice and the plan a third time:
 *
 *   **AI never draws the garment** (spec decision 13, principle 4). Every picture starts from the
 *   deterministic render or the golden-sample photo, the model changes only the scene, the light,
 *   the pose and the camera, and `lib/media-check` measures what came back against the render.
 *
 * So there is no field here for "draw the garment", no field for a placement inside the scene
 * (F-L1: "Users cannot drag the print area"), and the only asset this workstream can hand the
 * launch shell is a `SceneAsset`, whose role is the literal `"scene"` (`lib/launch/assets.ts`).
 *
 * Every value below is a tag, a label or a fact about a row. **None of them is a price, a licence
 * or a consent**: those three are facts about the world, they are held as data a person sets, and
 * a run is refused rather than guessed at when one is missing.
 */

/** No rulebook entry covers the shoot studio yet, so every row, finding and refusal carries this. */
export const SHOOT_GAP_RULE = "R-GAP-000";

/** The words every seeded row carries, so nobody reads a seeded row as a reviewed one. */
export const SEEDED_NOTE =
  "Seeded from docs/spec/02-features.md (F-L1) and docs/spec/07-template-library.md. Not reviewed by anyone.";

/** F-L1's style picker ("a picker like Kittl's Browse styles"), in the order the spec lists it. */
export const SHOOT_STYLES = ["editorial", "matchday-flash", "gritty-training", "clean-ecom", "retro-film"] as const;
export type ShootStyle = (typeof SHOOT_STYLES)[number];

export const SHOOT_STYLE_LABELS: Readonly<Record<ShootStyle, string>> = {
  editorial: "Editorial",
  "matchday-flash": "Matchday flash",
  "gritty-training": "Gritty training",
  "clean-ecom": "Clean e-com",
  "retro-film": "Retro film",
};

/**
 * What each style asks the model for, in the words that go into the prompt. They describe light,
 * grade and camera and **nothing about the garment**, because the garment is not the model's to
 * change.
 */
export const SHOOT_STYLE_PROMPTS: Readonly<Record<ShootStyle, string>> = {
  editorial: "Editorial fashion lighting, soft key from one side, deep clean shadows.",
  "matchday-flash": "On-camera flash at night, hard shadow behind, floodlit stadium feel.",
  "gritty-training": "Overcast daylight, high contrast, sweat and dust in the air.",
  "clean-ecom": "Even softbox light, plain seamless backdrop, no cast shadow.",
  "retro-film": "35mm film grain, warm cast, slight halation in the highlights.",
};

/**
 * F-L1's aspect picker: "Match / 1:1 / 4:5 / 9:16 / 16:9". `match` is the scene's own first crop,
 * so a scene keeps the shape `07` gave it unless a person asks for another.
 */
export const SHOOT_ASPECTS = ["match", "1:1", "4:5", "9:16", "16:9"] as const;
export type ShootAspect = (typeof SHOOT_ASPECTS)[number];

export const SHOOT_ASPECT_LABELS: Readonly<Record<ShootAspect, string>> = {
  match: "Match the scene",
  "1:1": "Square 1:1",
  "4:5": "Portrait 4:5",
  "9:16": "Story 9:16",
  "16:9": "Wide 16:9",
};

/** F-L1: "image count 1–4". */
export const MIN_IMAGE_COUNT = 1;
export const MAX_IMAGE_COUNT = 4;
export const IMAGE_COUNTS: readonly number[] = [1, 2, 3, 4];

/** F-L1: "plus up to 2 more Knitwright products for an outfit". */
export const MAX_EXTRA_PRODUCTS = 2;

/** Which list a pose or camera row came from. Nothing in this directory invents one. */
export const PRESET_SOURCES = ["spec", "scene"] as const;
export type PresetSource = (typeof PRESET_SOURCES)[number];

/** A pose or a camera a shoot may ask for. Both live in `shoot_poses`, told apart by `kind`. */
export const POSE_KINDS = ["pose", "camera"] as const;
export type PoseKind = (typeof POSE_KINDS)[number];

export interface ShootPose {
  readonly key: string;
  readonly kind: PoseKind;
  readonly label: string;
  /** The words that go into the prompt. They move the person and the camera, never the garment. */
  readonly prompt: string;
  /** Whether a person has to be in the picture for this pose to mean anything. */
  readonly needsPerson: boolean;
  readonly source: PresetSource;
  readonly ruleId: string;
  readonly note: string;
}

/**
 * A model preset: a person a model draws, with **the licence that allows it** (plan v5 L3,
 * "`model_presets` with licence ref"; `07`: "the model presets allowed (all AI-generated and
 * licensed; no real people)").
 *
 * `licenceRef` is `string | null`, and a preset with none **cannot be run**. That is the same shape
 * L5 gave an unpriced video model (`lib/media/video/models.ts`): a fact nobody has established is
 * carried as absent, never as a default, because a person's likeness is not something to assume.
 * No preset here names a person and none carries a photograph: the row describes the body type,
 * age band and skin tone the spec asks the library to cover, and says plainly that nobody has
 * licensed one yet.
 */
export interface ModelPreset {
  readonly key: string;
  readonly label: string;
  /** F-L1: "diverse body types, ages and skin tones". Each is a word on the card. */
  readonly bodyType: string;
  readonly ageBand: string;
  readonly skinTone: string;
  /** The licence that allows this likeness to be generated, or null while nobody has one on file. */
  readonly licenceRef: string | null;
  /** Who holds that licence, or null. Shown beside the ref so a reader can go and look. */
  readonly licenceHolder: string | null;
  readonly ruleId: string;
  readonly note: string;
}

/** Where the person in the picture comes from. A shoot with nobody in it uses `none`. */
export const MODEL_SOURCES = ["none", "preset", "upload"] as const;
export type ModelSource = (typeof MODEL_SOURCES)[number];

/**
 * What a brand recorded when it uploaded a photograph of its own model (F-L1: "or upload a model
 * with a consent tick").
 *
 * **A consent is a record, never an assumption.** All three fields are required together, and the
 * database says the same with a check constraint, so a shoot cannot be run from an upload whose
 * consent nobody wrote down.
 */
export interface ModelConsent {
  /** What the brand holds: a release form reference, an agreement number, a file name. */
  readonly ref: string;
  /** The words the brand ticked, kept so what was agreed to is not re-worded later. */
  readonly statement: string;
  /** ISO date-time the brand recorded it. */
  readonly givenAt: string;
}

/** The sentence a brand ticks when it uploads its own model. Kept with the record, not re-worded. */
export const CONSENT_STATEMENT =
  "This person has agreed in writing that their likeness may be used in pictures this brand generates, and I hold that agreement.";

/**
 * One shoot idea of F-L1's "Shoot ideas library": "Each concept bundles scene, lighting, camera,
 * 3–6 poses, model presets and an output set."
 *
 * A concept never holds a scene of its own: it names the `mockup_scene` rows L2 seeded and marked
 * for this workstream, so the library has one list of scenes and not two.
 */
export interface ShootConcept {
  readonly slug: string;
  readonly title: string;
  readonly lead: string;
  /** The AI scenes of `07` this concept shoots, by their `templates` slug. */
  readonly sceneSlugs: readonly string[];
  readonly lighting: string;
  /** The camera rows this concept offers, by key. */
  readonly cameraKeys: readonly string[];
  /** The pose rows this concept offers, by key. `07` asks for 3 to 6; `conceptGap` says when fewer. */
  readonly poseKeys: readonly string[];
  /** The model presets this concept allows. Empty for a concept with nobody in the picture. */
  readonly modelPresetKeys: readonly string[];
  readonly style: ShootStyle;
  /** `07`'s "output set": how many pictures, in which shapes. */
  readonly outputs: Readonly<{ count: number; aspects: readonly ShootAspect[] }>;
  /** True when a person has to be in the picture, so a model preset or an upload is needed. */
  readonly needsModel: boolean;
  readonly sports: readonly string[];
  readonly moods: readonly string[];
  readonly ruleId: string;
  readonly note: string;
}

/** One thing a shoot cannot say yet, with the rule that explains it. Shown on the card. */
export interface ShootGap {
  readonly ruleId: string;
  readonly line: string;
}

/** What one run of a shoot did: the row of `shoot_jobs` and the view a panel shows. */
export const SHOOT_JOB_STATUSES = ["queued", "running", "ready", "failed", "refused"] as const;
export type ShootJobStatus = (typeof SHOOT_JOB_STATUSES)[number];

export const SHOOT_JOB_STATUS_LABELS: Readonly<Record<ShootJobStatus, string>> = {
  queued: "Waiting to start",
  running: "Generating",
  ready: "Ready",
  failed: "Could not be kept",
  refused: "Not run",
};
