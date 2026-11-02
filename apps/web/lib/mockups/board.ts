import { isCrop, MOCKUP_EDGE } from "./crops";
import { KIT_ROLES, MOCKUP_GAP_RULE, type Crop, type KitRole, type MockupScene, type RosterEntry, type SceneGap } from "./types";

/**
 * A mockup board's own settings, and the live link that keeps it true (spec F-L1, "Mockup board").
 *
 * The board carries five things and nothing else: which scene, which crop, which kit role, which
 * colourway of the design, and which roster entry the shirt wears. They go through the panel
 * contract's `setBoardSettings`, which is a request to the shell and not a write
 * (`lib/launch/panels.ts`), and they come back as `boards.settings`, so they survive a reload and
 * `Regenerate` reruns the same picture.
 *
 * **There is no placement here on purpose.** F-L1: "Placement inside a photo scene is fixed by the
 * scene's garment slot, because the garment is the 3D render warped to the slot. Users cannot drag
 * the print area." A setting a panel cannot offer is a setting a person cannot get wrong.
 *
 * **The live link is `inputVersion`.** A board records the design version its picture was taken at
 * (`BoardView.inputVersion`, L1's own column). When the design is saved again, the version moves
 * and `staleAgainst` says so, which is what F-L1 means by "changing the design updates every linked
 * mockup": the board does not hold a copy of the design, it holds a pointer to a version, and the
 * one behind it is always the one on the canvas.
 *
 * No zod here, so a client panel may import this file without carrying a schema into the browser
 * (`tests/architecture/client-weight.test.ts`). The checks are plain and each one has a test.
 */

/**
 * The design's own rules for a sample name and number, repeated here as plain values rather than
 * imported, because `lib/garment/names-numbers.ts` carries zod and a client panel may not
 * (`tests/architecture/client-weight.test.ts`). `board.test.ts` imports the real ones and holds
 * these to them, so the two cannot drift apart without a test failing.
 */
export const ROSTER_NAME_MAX = 20;
export const ROSTER_NAME_DEFAULT = "PLAYER";
export const ROSTER_NUMBER_DEFAULT = "10";

/** Team numbers run from 0 to 99, and some codes use 00 -- the design's own rule, not a new one. */
const NUMBER_PATTERN = /^\d{1,2}$/;

export interface MockupBoardSettings {
  readonly sceneSlug: string;
  readonly crop: Crop;
  readonly kitRole: KitRole;
  /** The colourway of the design this board shows, or null for the design's own first. */
  readonly colourwayId: string | null;
  /** The shirt name and number, or null to show the garment with none. */
  readonly roster: RosterEntry | null;
  /** The longest side of the rendered picture, in pixels. */
  readonly edge: number;
}

/** What a board shows before anybody has chosen anything: the scene's own first crop, home kit. */
export function defaultSettings(scene: MockupScene): MockupBoardSettings {
  return {
    sceneSlug: scene.slug,
    crop: scene.crops[0] ?? "1:1",
    kitRole: "home",
    colourwayId: null,
    roster: null,
    edge: MOCKUP_EDGE,
  };
}

const text = (value: unknown): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

/** The roster entry in a stored value, or null. A half-written entry is no entry. */
export function rosterFrom(value: unknown): RosterEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const entry = value as { name?: unknown; number?: unknown };
  const name = text(entry.name);
  const number = text(entry.number);
  if (name === null || number === null) return null;
  if (name.length > ROSTER_NAME_MAX || !NUMBER_PATTERN.test(number)) return null;
  return { name, number };
}

/**
 * The settings a board carries, read back out of `boards.settings`. Anything missing or out of
 * range falls back to the scene's own default rather than refusing to draw the board, because a
 * board that cannot be read is still a board a person put on the canvas.
 */
export function settingsFrom(stored: Readonly<Record<string, unknown>>, scene: MockupScene): MockupBoardSettings {
  const fallback = defaultSettings(scene);
  const crop = text(stored.crop);
  const role = text(stored.kitRole);
  const edge = typeof stored.edge === "number" && Number.isFinite(stored.edge) ? Math.round(stored.edge) : fallback.edge;
  return {
    sceneSlug: scene.slug,
    crop: crop !== null && isCrop(crop) && scene.crops.includes(crop) ? crop : fallback.crop,
    kitRole: role !== null && (KIT_ROLES as readonly string[]).includes(role) ? (role as KitRole) : fallback.kitRole,
    colourwayId: text(stored.colourwayId),
    roster: rosterFrom(stored.roster),
    edge,
  };
}

/** The settings as the shell stores them: a plain record, which is what `setBoardSettings` takes. */
export const settingsToStored = (settings: MockupBoardSettings): Readonly<Record<string, unknown>> => ({
  sceneSlug: settings.sceneSlug,
  crop: settings.crop,
  kitRole: settings.kitRole,
  colourwayId: settings.colourwayId,
  roster: settings.roster,
  edge: settings.edge,
});

/** The scene slug a board names, or null for a board that has not been given a scene yet. */
export const sceneSlugOf = (stored: Readonly<Record<string, unknown>>): string | null => text(stored.sceneSlug);

/** F-L1's player "SMITH 7". Empty when the board shows no roster entry. */
export const rosterLabel = (roster: RosterEntry | null): string => (roster === null ? "" : `${roster.name} ${roster.number}`);

/** The roster entry a board starts from when somebody turns names and numbers on. */
export const startingRoster = (): RosterEntry => ({ name: ROSTER_NAME_DEFAULT, number: ROSTER_NUMBER_DEFAULT });

/** Why a roster entry was refused, or null when it is good. The panel shows this beside the field. */
export function rosterProblem(name: string, number: string): string | null {
  if (name.trim() === "") return "Type a name, such as SMITH.";
  if (name.trim().length > ROSTER_NAME_MAX) return `A name is at most ${ROSTER_NAME_MAX} characters.`;
  if (!NUMBER_PATTERN.test(number.trim())) return "Type a number from 0 to 99.";
  return null;
}

export interface Staleness {
  readonly stale: boolean;
  /** What the screen says. Empty when the board is already on the newest version. */
  readonly line: string;
}

/**
 * Whether a board's picture was taken at an older version of the design than the one on the canvas.
 * A board that has never run is not stale: it has nothing to be out of date.
 */
export function staleAgainst(inputVersion: number | null, designVersion: number | null): Staleness {
  if (inputVersion === null || designVersion === null || inputVersion >= designVersion) return { stale: false, line: "" };
  return {
    stale: true,
    line: `This mockup was drawn from version ${inputVersion} of the design and the canvas is on version ${designVersion}. Render it again to catch up.`,
  };
}

/**
 * The colourway of the design a kit role points at, found by its own name, or null when the design
 * has no colourway by that name. **Nothing here renames a colourway or makes one up**: a design's
 * colourways are the brand's, and a role that finds none says so (`roleGap`).
 */
export function colourwayForRole(role: KitRole, colourways: readonly { readonly id: string; readonly name: string }[]): string | null {
  const wanted = role === "goalkeeper" ? ["goalkeeper", "keeper", "gk"] : [role];
  const found = colourways.find((one) => wanted.some((word) => one.name.trim().toLowerCase().includes(word)));
  return found?.id ?? null;
}

/** What the screen says when a kit role matches no colourway of the design. */
export function roleGap(role: KitRole, colourways: readonly { readonly id: string; readonly name: string }[]): SceneGap | null {
  if (colourwayForRole(role, colourways) !== null) return null;
  return {
    ruleId: MOCKUP_GAP_RULE,
    line: `This design has no colourway named for the ${role} kit, so the mockup shows the colourway you choose instead. Home, Away and GK are the colourway names 07 uses; a design names its own.`,
  };
}
