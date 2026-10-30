import { withEditorState } from "@/lib/editor";
import { KIT_PARTS, sportById, type KitPartId } from "./vocabulary";
import type { PartChoice } from "./kit";

/**
 * The configurator's own address, and the address "Design in Studio" opens.
 *
 * The sport, the part showing and the market are in the address, because the server reads the right
 * base articles and the right price ladder from them. Everything the person then changes stays in
 * the browser until Save: a configurator that saved on every tap would make a design version per
 * colour.
 *
 * "Design in Studio" opens the saved design in the Y2 editor with the very form the configurator
 * had, through the editor's own `withEditorState` (decision 0075). The form travels in the address
 * rather than in the design because no change in the design contract writes a base article's
 * parameters yet; the editor reads it back with `readAddress` and re-drafts, so the editor shows
 * the same kit the club just configured.
 */

export const PARAMS = { sport: "sport", part: "part", market: "market", view: "view", project: "project", version: "v" } as const;

export type Query = Readonly<Record<string, string | readonly string[] | undefined>>;

const first = (value: string | readonly string[] | undefined): string | null =>
  value === undefined ? null : typeof value === "string" ? value : value[0] ?? null;

/** The part the right panel is showing. Anything the sport does not offer falls back to its first part. */
export function parsePart(query: Query, sportId: string): KitPartId {
  const sport = sportById(sportId);
  const asked = first(query[PARAMS.part]);
  const offered = KIT_PARTS.filter((id) => sport.parts[id] !== null);
  return offered.find((id) => id === asked) ?? offered[0] ?? "shirt";
}

export const parseSport = (query: Query): string => sportById(first(query[PARAMS.sport])).id;

/** The saved design the configurator is showing, or null when nothing has been saved yet. */
export function parseSaved(query: Query): Readonly<{ projectId: string; version: number }> | null {
  const projectId = first(query[PARAMS.project]);
  const version = Number(first(query[PARAMS.version]));
  if (projectId === null || !/^[0-9a-f-]{36}$/.test(projectId)) return null;
  return Number.isInteger(version) && version >= 1 ? { projectId, version } : null;
}

/** The configurator's own address with one sport, part and market chosen. */
export function configuratorHref(state: Readonly<{ sportId: string; part: KitPartId; market?: string; saved?: Readonly<{ projectId: string; version: number }> | null }>): string {
  const params = new URLSearchParams();
  params.set(PARAMS.sport, state.sportId);
  params.set(PARAMS.part, state.part);
  if (state.market) params.set(PARAMS.market, state.market);
  if (state.saved) {
    params.set(PARAMS.project, state.saved.projectId);
    params.set(PARAMS.version, String(state.saved.version));
  }
  return `/teamwear?${params.toString()}`;
}

/**
 * Where "Design in Studio" goes: the saved design in the editor, on the 3D canvas, with the Form
 * toolbar open and the configurator's own option codes and parameters in the address.
 */
export const studioHref = (projectId: string, choice: PartChoice): string =>
  `/studio/${projectId}${withEditorState("", { segment: "form", view: "3d", beside: null, size: null, form: choice.form })}`;
