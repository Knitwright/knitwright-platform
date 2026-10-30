/**
 * "Jump back in" (spec F-S4, "Body"): the filter chips All · Designs · Collections · Moodboards ·
 * Mockups · Flows, and the coloured type tag each card carries.
 *
 * Only designs are stored today. A chip for a kind the platform does not keep yet is still shown,
 * still reachable by keyboard, and says "Coming in a later release" instead of showing nothing.
 */

export const JUMP_KINDS = ["designs", "collections", "moodboards", "mockups", "flows"] as const;
export type JumpKind = (typeof JUMP_KINDS)[number];

/** The chip ids: "all" and one per kind. */
export const JUMP_CHIPS = ["all", ...JUMP_KINDS] as const;
export type JumpChip = (typeof JUMP_CHIPS)[number];

export interface JumpChipView {
  readonly id: JumpChip;
  readonly label: string;
  /** False where nothing of that kind can exist yet. */
  readonly built: boolean;
}

const LABELS: Readonly<Record<JumpChip, string>> = {
  all: "All",
  designs: "Designs",
  collections: "Collections",
  moodboards: "Moodboards",
  mockups: "Mockups",
  flows: "Flows",
};

/** The only kind the platform stores today. */
const BUILT: readonly JumpChip[] = ["all", "designs"];

export const JUMP_CHIP_VIEWS: readonly JumpChipView[] = JUMP_CHIPS.map((id) => ({
  id,
  label: LABELS[id],
  built: BUILT.includes(id),
}));

/** The chip an address asks for. Anything else falls back to "all", so a mistyped address still shows the row. */
export const chipFromQuery = (value: string | readonly string[] | undefined): JumpChip => {
  const asked = Array.isArray(value) ? value[0] : value;
  return JUMP_CHIPS.find((chip) => chip === asked) ?? "all";
};

/** The address of the row with one chip chosen. */
export const chipHref = (path: string, chip: JumpChip): string => (chip === "all" ? path : `${path}?jump=${chip}`);

/** Whether designs are shown for this chip: for "all" and "designs", and for nothing else. */
export const showsDesigns = (chip: JumpChip): boolean => chip === "all" || chip === "designs";

/** The one sentence a chip for a kind that is not built yet shows under the row. */
export const emptyFor = (chip: JumpChipView): string | null =>
  chip.built ? null : `${chip.label}: coming in a later release.`;

/** The type tag a card carries. Designs are the only kind stored, so only a design has a tag today. */
export const DESIGN_TAG = { label: "Design", kind: "designs" } as const;
