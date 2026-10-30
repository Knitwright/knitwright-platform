/**
 * The teamwear configurator's own words and tables (spec F-T1, plan v5 Z5, decision 0086).
 *
 * Everything here is data: which sports the configurator offers, which kit part stands on which
 * registry type and base article, which views the stage can show, and which rulebook entry explains
 * each rule it applies. No structural value appears here — those come only from the base article's
 * approved options and parameter ranges (spec decision 5).
 */

/** Used where the rulebook has no entry for a rule this code applies. Listed on the pull request. */
export const GAP_RULE_ID = "R-GAP-000";

/** The three parts of a kit, in the order the pill row shows them (spec F-T1 right panel). */
export const KIT_PARTS = ["shirt", "shorts", "socks"] as const;
export type KitPartId = (typeof KIT_PARTS)[number];

export const KIT_PART_LABELS: Readonly<Record<KitPartId, string>> = {
  shirt: "Shirt",
  shorts: "Shorts",
  socks: "Socks",
};

/**
 * Which registry type stands behind each kit part of a sport. A part with no type is not offered for
 * that sport; a type with no base article (`lib/catalogue` registry map) is offered as a colour
 * choice only and says plainly that it has no price yet.
 */
export interface SportDefinition {
  readonly id: string;
  readonly label: string;
  /** The registry family of `lib/garment/registry/teamwear`, so the type ids can be checked against it. */
  readonly family: string;
  /** The registry type for each kit part, or null where the sport has no such part. */
  readonly parts: Readonly<Record<KitPartId, string | null>>;
  /** Which backdrop the stage draws. */
  readonly backdrop: BackdropId;
}

/** The backdrops the stage can draw (spec F-T1: "pitch, court, gym"). Each is drawn in CSS; no picture is stored. */
export const BACKDROPS = ["pitch", "court", "gym"] as const;
export type BackdropId = (typeof BACKDROPS)[number];

export const BACKDROP_LABELS: Readonly<Record<BackdropId, string>> = {
  pitch: "A grass pitch",
  court: "An indoor court",
  gym: "A gym floor",
};

/**
 * The sports the configurator offers, from the teamwear registry families. Football is the only
 * family with all three kit parts; cricket has a shirt and trousers and no socks, and the Australian
 * winter code has one team top. Nothing is added that the registry does not hold.
 */
export const SPORTS: readonly SportDefinition[] = [
  {
    id: "football",
    label: "Football",
    family: "football",
    parts: { shirt: "football-shirt", shorts: "football-shorts", socks: "football-socks" },
    backdrop: "pitch",
  },
  {
    id: "cricket",
    label: "Cricket",
    family: "cricket",
    parts: { shirt: "cricket-shirt", shorts: "cricket-trousers", socks: null },
    backdrop: "pitch",
  },
  {
    id: "winter-code",
    label: "Winter code (Australia)",
    family: "winter-code",
    parts: { shirt: "winter-code-top", shorts: null, socks: null },
    backdrop: "pitch",
  },
];

export const DEFAULT_SPORT: SportDefinition = SPORTS[0]!;

export const sportById = (id: string | null | undefined): SportDefinition =>
  SPORTS.find((sport) => sport.id === id) ?? DEFAULT_SPORT;

/** The views the view chip offers, in the order it lists them (spec F-T1: Front, Back, Left, Right, Collar). */
export const STAGE_VIEWS = ["front", "back", "left", "right", "collar"] as const;
export type StageViewId = (typeof STAGE_VIEWS)[number];

export const STAGE_VIEW_LABELS: Readonly<Record<StageViewId, string>> = {
  front: "Front",
  back: "Back",
  left: "Left",
  right: "Right",
  collar: "Collar",
};

/** The vertical tool rail on the stage, in the order the spec draws it. */
export const RAIL_TOOLS = ["undo", "redo", "add-element", "ideas", "play", "fullscreen", "snapshot"] as const;
export type RailToolId = (typeof RAIL_TOOLS)[number];

export const RAIL_TOOL_LABELS: Readonly<Record<RailToolId, string>> = {
  undo: "Undo",
  redo: "Redo",
  "add-element": "Add an element",
  ideas: "Ideas",
  play: "Turn it round",
  fullscreen: "Full screen",
  snapshot: "Save a picture",
};

/**
 * Where the first 3D picture has to be on the screen by (spec F-T1 acceptance: "First 3D render
 * takes under 3 seconds on a mid-range laptop"). The browser test measures from the moment the
 * address was asked for to the first drawn frame.
 */
export const FIRST_RENDER_BUDGET_MS = 3_000;

/** Whether a measured first render meets the budget. A measurement that is not a number fails. */
export const withinFirstRenderBudget = (milliseconds: number): boolean =>
  Number.isFinite(milliseconds) && milliseconds >= 0 && milliseconds < FIRST_RENDER_BUDGET_MS;

/**
 * The rulebook entries this screen cites. Each one is read from `docs/spec/articles/JSY-SS-01/rulebook.md`;
 * where the rulebook has no entry the code uses `GAP_RULE_ID` and the pull request lists it.
 */
export const RULES = {
  /** Options add sewing time; their prices come from the factory profile. */
  optionCost: "R-COST-002",
  /** Full sublimation costs the same whether the design is plain or busy. */
  patternCost: "R-COST-001",
  /** Names and numbers are printed in the same pass; the per-piece price is a placeholder. */
  personalisationCost: "R-COST-003",
  /** Names and numbers are printed in the same sublimation pass. */
  personalisationMethod: "R-PER-004",
  /** Critical artwork keeps 15 mm away from a seam. */
  elementPlacement: "R-SUB-004",
} as const;
