import { artboardUnit, type ArtboardUnit } from "./artboard";
import { clampZoom, DEFAULT_ZOOM, dockTool, type DockTool } from "./dock";
import { parseRail, type RailId } from "./rail";

/**
 * The shell's own state lives in the address, as the editor's does (`lib/editor/address.ts`):
 * which rail panel is open, which board is selected, which tool the dock has, the unit and the
 * zoom. A reload or a shared link therefore opens the same project in the same state, and nothing
 * about where a person was looking has to be stored.
 *
 * The unit is in the address as well as on the project row. The row is the person's own setting
 * from the main menu; the address wins while it is there, so a link can show someone a size in
 * millimetres without changing their project.
 */

export const PARAMS = {
  rail: "panel",
  board: "board",
  /** "1" when the board's finished picture is selected rather than the board itself. */
  image: "image",
  tool: "tool",
  unit: "unit",
  zoom: "zoom",
} as const;

export type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

export interface LaunchAddress {
  readonly rail: RailId;
  readonly boardId: string | null;
  readonly image: boolean;
  readonly tool: DockTool;
  /** The unit the address asks for, or null to use the project's own. */
  readonly unit: ArtboardUnit | null;
  readonly zoom: number;
}

const first = (value: string | readonly string[] | undefined): string | null =>
  (typeof value === "string" ? value : value?.[0]) ?? null;

/** A board id in the address: a plain identifier, never anything that could be read as markup. */
const boardIdFrom = (value: string | null): string | null => (value && /^[0-9a-zA-Z-]{1,64}$/.test(value) ? value : null);

/** The state the address names. Anything missing or unknown takes its default. */
export function readAddress(query: Query): LaunchAddress {
  const unit = first(query[PARAMS.unit]);
  const zoom = Number(first(query[PARAMS.zoom]) ?? Number.NaN);
  return {
    rail: parseRail(query[PARAMS.rail]),
    boardId: boardIdFrom(first(query[PARAMS.board])),
    image: first(query[PARAMS.image]) === "1",
    tool: dockTool(query[PARAMS.tool]),
    unit: unit === null ? null : artboardUnit(unit),
    zoom: Number.isFinite(zoom) ? clampZoom(zoom) : DEFAULT_ZOOM,
  };
}

export interface LaunchState {
  readonly rail: RailId;
  readonly boardId: string | null;
  readonly image: boolean;
  readonly tool: DockTool;
  readonly unit: ArtboardUnit;
  readonly zoom: number;
}

/**
 * The query of an address with the shell's state set and every other parameter kept, starting with
 * "?". A default is left out rather than written, so a plain link stays short.
 */
export function withLaunchState(search: string, state: LaunchState): string {
  const params = new URLSearchParams(search);
  params.set(PARAMS.rail, state.rail);
  params.set(PARAMS.tool, state.tool);
  params.set(PARAMS.unit, state.unit);
  if (state.boardId) params.set(PARAMS.board, state.boardId);
  else params.delete(PARAMS.board);
  if (state.boardId && state.image) params.set(PARAMS.image, "1");
  else params.delete(PARAMS.image);
  if (state.zoom === DEFAULT_ZOOM) params.delete(PARAMS.zoom);
  else params.set(PARAMS.zoom, String(clampZoom(state.zoom)));
  return `?${params.toString()}`;
}
