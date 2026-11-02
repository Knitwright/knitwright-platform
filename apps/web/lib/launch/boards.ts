/**
 * The boards of a launch project (plan v5 wave 4 L1, spec F-L4's board table).
 *
 * A launch project is a canvas of boards joined by connectors. Seven kinds exist, and the kind
 * decides three things nothing else in this directory is allowed to decide for itself:
 *
 *   1. what may feed the board (`accepts`, `maxInputs`), so a connector the spec's table does not
 *      allow cannot be drawn;
 *   2. whether running it spends credits (`paid`);
 *   3. **whether its output may ever become artwork.** A board whose picture comes out of a model
 *      never may. That is spec decision 13 -- AI never draws the garment -- and here it is a
 *      property of the kind, not a check somebody has to remember to call. `lib/launch/assets.ts`
 *      turns it into a type a generated asset cannot satisfy, and the migration's
 *      `boards_generated_output_is_never_artwork` constraint says the same in the database.
 */

export const BOARD_KINDS = ["design", "artboard", "mockup", "ai_image", "ai_video", "marketing", "info_card"] as const;
export type BoardKind = (typeof BOARD_KINDS)[number];

/** The boards the platform draws itself, from the design, the catalogue or the person's own layout. */
export const DETERMINISTIC_KINDS = ["design", "artboard", "mockup", "marketing", "info_card"] as const;

/** The boards whose picture comes out of a model. Their output is scenery and never artwork. */
export const GENERATED_KINDS = ["ai_image", "ai_video"] as const;

export type GeneratedKind = (typeof GENERATED_KINDS)[number];

export const isGeneratedKind = (kind: BoardKind): kind is GeneratedKind =>
  (GENERATED_KINDS as readonly BoardKind[]).includes(kind);

/**
 * Whether this kind's output may be put on a panel of the garment or into a print file. Only a
 * board the platform drew itself may: a generated picture is scenery (spec decision 13).
 */
export const canBeArtwork = (kind: BoardKind): boolean => !isGeneratedKind(kind);

export const BOARD_STATUSES = ["empty", "queued", "running", "ready", "failed"] as const;
export type BoardStatus = (typeof BOARD_STATUSES)[number];

/** What a board's output is used as. A generated board's output can only ever be `asset`. */
export const OUTPUT_ROLES = ["asset", "panel_layer", "print_file"] as const;
export type OutputRole = (typeof OUTPUT_ROLES)[number];

export interface BoardKindInfo {
  readonly id: BoardKind;
  /** The words on the board's label and in the Add… menu. */
  readonly label: string;
  /** One sentence on what the board makes, for the Add… menu and for an empty board. */
  readonly lead: string;
  /** The kinds a connector into this board may come from. Empty: nothing may feed it. */
  readonly accepts: readonly BoardKind[];
  /** How many connectors may end here. The spec's AI Image board takes several ("image 1", "image 2"). */
  readonly maxInputs: number;
  /** True when running the board spends credits. Every deterministic board is free (spec F-L4). */
  readonly paid: boolean;
  /** The rulebook entry that explains the board's inputs and its cost. */
  readonly ruleId: string;
}

/**
 * No rulebook entry covers the launch canvas yet, so every board carries `R-GAP-000` and the pull
 * request lists it. Nothing here invents a rule's words.
 */
export const LAUNCH_GAP_RULE = "R-GAP-000";

export const BOARDS: Readonly<Record<BoardKind, BoardKindInfo>> = {
  design: {
    id: "design",
    label: "Design",
    lead: "One of your designs, at one colourway and size. Every other board starts from this one.",
    accepts: [],
    maxInputs: 0,
    paid: false,
    ruleId: LAUNCH_GAP_RULE,
  },
  artboard: {
    id: "artboard",
    label: "Artboard",
    lead: "A page at a size you choose, for text, logos and the boards you place on it.",
    accepts: [],
    maxInputs: 0,
    paid: false,
    ruleId: LAUNCH_GAP_RULE,
  },
  mockup: {
    id: "mockup",
    label: "Mockup",
    lead: "The design in a scene the platform draws. It follows the design: change the design and this changes with it.",
    accepts: ["design"],
    maxInputs: 1,
    paid: false,
    ruleId: LAUNCH_GAP_RULE,
  },
  ai_image: {
    id: "ai_image",
    label: "AI image",
    lead: "A scene around the garment. The garment itself stays the picture the platform drew.",
    accepts: ["design", "mockup", "ai_image"],
    maxInputs: 4,
    paid: true,
    ruleId: LAUNCH_GAP_RULE,
  },
  ai_video: {
    id: "ai_video",
    label: "AI video",
    lead: "A clip between a first and an end frame. Both frames are pictures the platform drew.",
    accepts: ["mockup", "ai_image"],
    maxInputs: 2,
    paid: true,
    ruleId: LAUNCH_GAP_RULE,
  },
  marketing: {
    id: "marketing",
    label: "Marketing",
    lead: "A post, story or banner built around the boards you feed it. The pictures stay as they are.",
    accepts: ["design", "mockup", "ai_image", "ai_video", "info_card"],
    maxInputs: 6,
    paid: false,
    ruleId: LAUNCH_GAP_RULE,
  },
  info_card: {
    id: "info_card",
    label: "Info card",
    lead: "A size chart, colour chart or care card, read from the factory file and the catalogue.",
    accepts: ["design"],
    maxInputs: 1,
    paid: false,
    ruleId: LAUNCH_GAP_RULE,
  },
};

/** The kinds the connector dot's Add… menu offers, in the order the spec lists them (F-L4). */
export const ADD_MENU_KINDS: readonly BoardKind[] = ["mockup", "ai_image", "ai_video", "marketing", "info_card"];

const isKind = (value: string): value is BoardKind => (BOARD_KINDS as readonly string[]).includes(value);

/** The board kind a name stands for, or null. Used for the address and for reading input. */
export const boardKind = (value: string | null | undefined): BoardKind | null => (value && isKind(value) ? value : null);

/**
 * The kinds the Add… menu of one board's connector dot offers: the kinds whose own `accepts` list
 * names the board the dot belongs to.
 */
export function kindsAddableAfter(kind: BoardKind): readonly BoardKind[] {
  return ADD_MENU_KINDS.filter((candidate) => BOARDS[candidate].accepts.includes(kind));
}
