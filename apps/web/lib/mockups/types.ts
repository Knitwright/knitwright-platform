/**
 * The mockup studio's own vocabulary (plan v5 wave 4 L2, spec F-L1 and `07-template-library.md`).
 *
 * A mockup scene is a place the platform puts a garment it drew itself. `07` says what a scene
 * defines: garment slots, each with a pose and a camera; a background, a light and the crops it may
 * be cut to; whether it is deterministic (free, from the 3D render) or AI-generated (credits); and
 * the model presets it allows. Nothing here draws the garment, and nothing here calls a model.
 *
 * **The garment is always locked** (spec decision 13, plan v5 wave 4 preamble). Every picture this
 * directory makes starts from the deterministic render or the golden-sample photo, so the only
 * provenance it can produce is `deterministic` or `golden_sample`, never `generated`. A scene the
 * spec marks AI-generated is carried here as data and left for L3 to run; this workstream renders
 * only the deterministic half.
 *
 * Every value below is a tag for finding or placing a scene on a screen. None of them is a factory
 * fact, and none is a measurement.
 */

/** The seven scene groups of `07`'s mockup-scene table, in the order the panel shows them. */
export const SCENE_GROUPS = ["product", "teamwear", "training", "running", "combat", "esports", "retail"] as const;
export type SceneGroup = (typeof SCENE_GROUPS)[number];

export const SCENE_GROUP_LABELS: Readonly<Record<SceneGroup, string>> = {
  product: "Product shots",
  teamwear: "Teamwear",
  training: "Training and gym",
  running: "Running",
  combat: "Combat",
  esports: "Esports",
  retail: "Retail and e-commerce",
};

/**
 * Where a scene's picture comes from. `07`: "whether it is deterministic (free, from 3D) or
 * AI-generated (credits)". A `deterministic` scene is this workstream's; an `ai` scene is L3's and
 * carries the crown the spec puts on a premium item.
 */
export const SCENE_SOURCES = ["deterministic", "ai"] as const;
export type SceneSource = (typeof SCENE_SOURCES)[number];

/** The crops `07` gives every scene. The same four aspects the launch shell's artboards use. */
export const CROPS = ["1:1", "4:5", "9:16", "16:9"] as const;
export type Crop = (typeof CROPS)[number];

/** F-L1's "people (none / 1 / team)" filter. */
export const PEOPLE_BANDS = ["none", "one", "team"] as const;
export type PeopleBand = (typeof PEOPLE_BANDS)[number];

export const PEOPLE_BAND_LABELS: Readonly<Record<PeopleBand, string>> = {
  none: "No people",
  one: "One person",
  team: "A team",
};

/** The four sides of the garment F-L1 asks for in the free product shots. */
export const GARMENT_VIEWS = ["front", "back", "three-quarter", "side"] as const;
export type GarmentView = (typeof GARMENT_VIEWS)[number];

export const GARMENT_VIEW_LABELS: Readonly<Record<GarmentView, string>> = {
  front: "Front",
  back: "Back",
  "three-quarter": "Three-quarter",
  side: "Side",
};

/** How the garment is held in a slot. Each one is drawn by this workstream, never by a model. */
export const PRESENTATIONS = ["flat", "hanging", "folded", "ghost", "worn", "turning", "chart"] as const;
export type Presentation = (typeof PRESENTATIONS)[number];

/** A rectangle on the scene canvas as a fraction of it, so one scene fits every crop. */
export interface SlotFrame {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * One garment slot of a scene (`07`: "garment slots (1-11), each with a pose and camera").
 *
 * **The frame is the scene's, never the person's** (F-L1: "Placement inside a photo scene is fixed
 * by the scene's garment slot ... Users cannot drag the print area"). Nothing in this directory
 * takes a placement from the browser.
 */
export interface GarmentSlot {
  readonly index: number;
  readonly view: GarmentView;
  readonly presentation: Presentation;
  /** The pose the slot is posed in, in words a card can show. */
  readonly pose: string;
  /** The camera the slot is seen from, in words a card can show. */
  readonly camera: string;
  readonly frame: SlotFrame;
}

/** What is behind the garment. Every one is drawn by us, so no third-party photograph is stored. */
export const BACKDROP_KINDS = ["white", "colour", "surface", "gradient"] as const;
export type BackdropKind = (typeof BACKDROP_KINDS)[number];

export interface Backdrop {
  readonly key: string;
  readonly label: string;
  readonly kind: BackdropKind;
  /** `#rrggbb`. The second colour of a gradient, where there is one, is `hexTwo`. */
  readonly hex: string;
  readonly hexTwo?: string;
  /** Says where the backdrop came from. Every one of ours says we drew it. */
  readonly note: string;
}

/** A card a scene draws instead of a garment: the size chart and the colour chart of F-L1. */
export const CHART_CARDS = ["size-chart", "colour-chart"] as const;
export type ChartCard = (typeof CHART_CARDS)[number];

/** Which workstream renders a scene. `L3` scenes are carried as data here and run there. */
export const SCENE_OWNERS = ["L2", "L3"] as const;
export type SceneOwner = (typeof SCENE_OWNERS)[number];

/** One mockup scene, exactly as a `templates` row of kind `mockup_scene` holds it. */
export interface MockupScene {
  readonly slug: string;
  readonly title: string;
  readonly group: SceneGroup;
  readonly source: SceneSource;
  readonly slots: readonly GarmentSlot[];
  readonly backdrop: Backdrop;
  /** The light the scene is lit by, in words a card can show. */
  readonly lighting: string;
  readonly crops: readonly Crop[];
  readonly people: PeopleBand;
  /** The sport tags of `07`'s launch tag set, for the panel's sport filter. */
  readonly sports: readonly string[];
  /** The mood tags of `07`'s launch tag set, for the panel's mood filter. */
  readonly moods: readonly string[];
  /** The model presets a generated scene may use. Empty for a scene with no people in it. */
  readonly modelPresets: readonly string[];
  /** The chart this scene draws instead of a garment, or null. */
  readonly card: ChartCard | null;
  readonly owner: SceneOwner;
  /** `R-<TOPIC>-<NNN>`, or `R-GAP-000` where no rulebook entry covers the scene yet. */
  readonly ruleId: string;
  /** What the screen says about where this scene's values came from. Never reads as settled. */
  readonly note: string;
}

/** A kit role the colourway switcher offers (F-L1: "one scene can render Home, Away and GK"). */
export const KIT_ROLES = ["home", "away", "goalkeeper"] as const;
export type KitRole = (typeof KIT_ROLES)[number];

export const KIT_ROLE_LABELS: Readonly<Record<KitRole, string>> = {
  home: "Home",
  away: "Away",
  goalkeeper: "Goalkeeper",
};

/** The shirt name and number a slot wears (F-L1: player "SMITH 7"). */
export interface RosterEntry {
  readonly name: string;
  readonly number: string;
}

/** One thing a scene cannot show yet, with the rule that explains it. Shown on the card. */
export interface SceneGap {
  readonly ruleId: string;
  readonly line: string;
}

/** No rulebook entry covers the mockup studio yet, so everything here carries this one. */
export const MOCKUP_GAP_RULE = "R-GAP-000";
