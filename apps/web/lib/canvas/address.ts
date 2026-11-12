import type { Route } from "next";

/**
 * The one canvas's address (decision 0145): `/project/<id>`.
 *
 * `<id>` is a canvas's own id (a launch project) or a studio design's id, which opens that design's
 * home canvas. `?focus=garment` opens the design's garment board in focused mode -- the editor, in
 * place on the canvas -- and `?focus=<board id>` opens any garment board of the canvas that way.
 * Every other query (the editor's `view`, `colourway`, the launch shell's `board`, `panel`, `zoom`)
 * is the surface's own and is carried through untouched.
 */

/** The focus value that names "this design's own garment board". */
export const OWN_GARMENT = "garment";

type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isUuid = (value: string): boolean => UUID.test(value);

const first = (value: string | readonly string[] | undefined): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));

/** What the address asks to focus: the design's own garment, one board by id, or nothing. */
export function readFocus(query: Query): string | null {
  const asked = first(query["focus"]);
  if (asked === OWN_GARMENT) return OWN_GARMENT;
  return asked !== undefined && isUuid(asked) ? asked : null;
}

/** The canvas of a design or of a launch project. */
export const projectHref = (id: string): Route => `/project/${id}` as Route;

/**
 * A design open in the editor, in place on its canvas. `extra` is the editor's own query -- a view,
 * a colourway -- carried as it would have been on the old `/studio/<id>` address.
 */
export function garmentEditorHref(designId: string, extra: Readonly<Record<string, string>> = {}): Route {
  const query = new URLSearchParams({ focus: OWN_GARMENT, ...extra });
  return `/project/${designId}?${query.toString()}` as Route;
}

/** The canvas's address with the focus taken off, keeping nothing else: "Back to canvas". */
export const canvasHref = (id: string): Route => projectHref(id);
