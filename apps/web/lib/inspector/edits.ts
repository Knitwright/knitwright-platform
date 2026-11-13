import type { DesignChange, GarmentInspectorView, InspectorSlider, StoredColourway } from "./types";

/**
 * The changes the garment inspector's own controls make (plan v6 E3, decision 0147), built in the
 * browser from what the server sent. No zod and no garment rules here, so the inspector stays light
 * (`tests/architecture/client-weight.test.ts`): each change goes to the editor's own action, which
 * reads it with `browserActionSchema`, applies it through the garment library, refuses anything the
 * article does not offer, stores a version and runs `lib/validation` -- the same path as the editor.
 *
 * The option tiles (collar, sleeve finish…) are not a design change. No design field holds an option
 * code yet, so the editor keeps them in the address (`opt=group:CODE`, `lib/editor/address.ts`) and
 * the inspector does the same, carrying them into the editor when it is opened.
 */

const SWATCH = /^#[0-9a-f]{6}$/;

/** Whether a value is on the slider: inside its range and on a whole step from its minimum. */
export function onSlider(slider: Pick<InspectorSlider, "min" | "max" | "step">, value: number): boolean {
  if (!Number.isFinite(value) || value < slider.min || value > slider.max) return false;
  if (slider.step <= 0) return true;
  const steps = (value - slider.min) / slider.step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

/** The change that stores one parameter on the design's base article, or null when the value is not on the slider. */
export function parameterChange(article: GarmentInspectorView["article"], slider: InspectorSlider, value: number): DesignChange | null {
  if (article === null || !onSlider(slider, value)) return null;
  return { type: "set-article", article: { ...article, parameters: { ...article.parameters, [slider.key]: value } } };
}

/** The change that gives one part of the shown colourway a new screen colour, keeping its colour code. */
export function swatchChange(colourway: StoredColourway, panelId: string, hex: string): DesignChange | null {
  const swatch = hex.trim().toLowerCase();
  if (!SWATCH.test(swatch)) return null;
  const existing = colourway.colours.find((entry) => entry.panelId === panelId);
  const entry = { panelId, colour: existing?.colour ?? "", swatch, provenance: "user-edited" };
  const colours = existing
    ? colourway.colours.map((one) => (one.panelId === panelId ? entry : { ...one, provenance: "user-edited" }))
    : [...colourway.colours.map((one) => ({ ...one, provenance: "user-edited" })), entry];
  return { type: "update-colourway", colourway: { id: colourway.id, name: colourway.name, colours } };
}

/** The editor's address keys for the form (`lib/editor/address.ts` PARAMS). */
const OPTION_KEY = "opt";
const PARAMETER_KEY = "par";

/** The option codes an address names, as `group → code`. */
export function optionsIn(search: string): Readonly<Record<string, string>> {
  const found: Record<string, string> = {};
  for (const pair of new URLSearchParams(search).getAll(OPTION_KEY)) {
    const at = pair.indexOf(":");
    if (at > 0 && at < pair.length - 1) found[pair.slice(0, at)] = pair.slice(at + 1);
  }
  return found;
}

/**
 * The full editor for a garment board, in place on its canvas (focused mode, decision 0145), opened on
 * the options the inspector shows and the parameters the design stores, so it starts where the
 * inspector left off.
 */
export function editorHref(
  canvasId: string,
  boardId: string,
  view: Pick<GarmentInspectorView, "options">,
  shown: Readonly<{ colourwayId: string | null; size: string | null }>,
): string {
  const params = new URLSearchParams({ focus: boardId });
  for (const group of view.options.groups) {
    const chosen = group.options.find((option) => option.chosen);
    if (chosen) params.append(OPTION_KEY, `${group.group}:${chosen.code}`);
  }
  for (const slider of view.options.sliders) params.append(PARAMETER_KEY, `${slider.key}:${slider.value}`);
  if (shown.colourwayId !== null) params.set("colourway", shown.colourwayId);
  if (shown.size !== null) params.set("size", shown.size);
  return `/project/${encodeURIComponent(canvasId)}?${params.toString()}`;
}
