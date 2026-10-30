import { parseSegment } from "./rail";
import type { CanvasView, FormValues, RailSegment } from "./slots";
import { parseBeside, parseView } from "./views";

/**
 * The editor's own state lives in the address, as the open tool already does (`?tool=`, decision
 * 0048): the rail segment, the canvas views, the shown size and the form the person has chosen.
 * A reload or a shared link therefore opens the same design in the same state, and the server
 * re-drafts it without anything being stored.
 *
 * The form is in the address rather than in the design because no `SpecAction` writes a base
 * article's parameters yet (decision 0069 added the field and no action; see decision 0075 and
 * the owner question on the pull request). Nothing here invents a value: a key the article does
 * not offer, or a value outside its approved range, is dropped by `resolveForm`.
 */

export const PARAMS = {
  rail: "rail",
  view: "view",
  beside: "beside",
  size: "size",
  /** One `group:CODE` per option group, repeated. */
  option: "opt",
  /** One `key:millimetres` per parameter, repeated. */
  parameter: "par",
} as const;

export type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

export interface EditorAddress {
  readonly segment: RailSegment;
  readonly view: CanvasView;
  readonly beside: CanvasView | null;
  /** The size label the address names, or null to use the design's base size. */
  readonly size: string | null;
  /** The pairs the address carries, unchecked: `resolveForm` decides what the article allows. */
  readonly options: Readonly<Record<string, string>>;
  readonly parameters: Readonly<Record<string, string>>;
}

const list = (value: string | readonly string[] | undefined): readonly string[] =>
  value === undefined ? [] : typeof value === "string" ? [value] : value;

const first = (value: string | readonly string[] | undefined): string | null => list(value)[0] ?? null;

/** Reads `key:value` pairs out of a repeated search parameter. A pair without a colon is dropped. */
function pairs(value: string | readonly string[] | undefined): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const entry of list(value)) {
    const at = entry.indexOf(":");
    if (at <= 0 || at === entry.length - 1) continue;
    found[entry.slice(0, at)] = entry.slice(at + 1);
  }
  return found;
}

/** The editor state the address names. Anything missing or unknown takes its default. */
export function readAddress(query: Query, defaultView: CanvasView): EditorAddress {
  const view = parseView(query[PARAMS.view], defaultView);
  return {
    segment: parseSegment(query[PARAMS.rail]),
    view,
    beside: parseBeside(query[PARAMS.beside], view),
    size: first(query[PARAMS.size]),
    options: pairs(query[PARAMS.option]),
    parameters: pairs(query[PARAMS.parameter]),
  };
}

/** The pairs of a form as the address writes them, in key order so the same form gives the same address. */
export function writeForm(form: FormValues): { readonly opt: readonly string[]; readonly par: readonly string[] } {
  const entries = <T>(record: Readonly<Record<string, T>>): [string, T][] => Object.entries(record).sort(([a], [b]) => a.localeCompare(b));
  return {
    opt: entries(form.options).map(([group, code]) => `${group}:${code}`),
    par: entries(form.parameters).map(([key, mm]) => `${key}:${mm}`),
  };
}

/**
 * The query of an address with the editor's state set and every other parameter kept, starting
 * with "?". Repeated parameters are replaced as a whole, never appended to.
 */
export function withEditorState(search: string, state: Readonly<{ size: string | null; form: FormValues }> & Pick<EditorAddress, "segment" | "view" | "beside">): string {
  const params = new URLSearchParams(search);
  params.set(PARAMS.rail, state.segment);
  params.set(PARAMS.view, state.view);
  if (state.beside) params.set(PARAMS.beside, state.beside);
  else params.delete(PARAMS.beside);
  if (state.size) params.set(PARAMS.size, state.size);
  else params.delete(PARAMS.size);
  const written = writeForm(state.form);
  params.delete(PARAMS.option);
  params.delete(PARAMS.parameter);
  for (const entry of written.opt) params.append(PARAMS.option, entry);
  for (const entry of written.par) params.append(PARAMS.parameter, entry);
  return `?${params.toString()}`;
}
