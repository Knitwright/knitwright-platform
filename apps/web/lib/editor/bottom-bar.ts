import type { ColourwayChoice } from "@/lib/projects/colour-controls";
import type { SpecAction } from "@/lib/garment";

/**
 * The bottom bar of the canvas (spec F-S4): the colourway selector (Home · Away · GK · + New) on
 * the left with the size selector, and Simulate with its status chip on the right.
 *
 * The names the spec shows are the ones a club's kit usually has, so a new colourway takes the
 * next of them that the design does not already use. Nothing is renamed: a design made before
 * keeps the name it has.
 */

/** The kit names of spec F-S4, in the order a club adds them. */
export const KIT_COLOURWAY_NAMES: readonly string[] = ["Home", "Away", "GK"];

/** The name a new colourway takes: the next kit name the design has not used, else a numbered one. */
export function nextColourwayName(existing: readonly string[]): string {
  const taken = new Set(existing.map((name) => name.toLowerCase()));
  const free = KIT_COLOURWAY_NAMES.find((name) => !taken.has(name.toLowerCase()));
  return free ?? `Colourway ${existing.length + 1}`;
}

/** An id for a new colourway that no existing one uses. Letters, numbers and dashes only, as the spec's ids are. */
export function newColourwayId(existing: readonly string[], name: string): string {
  const stem = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "colourway";
  if (!existing.includes(stem)) return stem;
  for (let n = 2; ; n += 1) if (!existing.includes(`${stem}-${n}`)) return `${stem}-${n}`;
}

/** The change that adds a colourway with no colours of its own yet. The person then gives it colours in the Colours panel. */
export function addColourwayAction(choices: readonly ColourwayChoice[]): SpecAction {
  const name = nextColourwayName(choices.map((choice) => choice.name));
  return { type: "add-colourway", colourway: { id: newColourwayId(choices.map((choice) => choice.id), name), name, colours: [] } };
}

/** The sizes the selector offers: the design's own size run, or the base article's when the design has none. */
export function sizeChoices(designSizes: readonly string[], articleSizes: readonly string[]): readonly string[] {
  return designSizes.length > 0 ? designSizes : articleSizes;
}

/** The size the canvas shows: the one asked for, when it is in the run, else the base size, else the first. */
export function shownSize(asked: string | null, sizes: readonly string[], baseSize: string): string {
  if (asked && sizes.includes(asked)) return asked;
  if (sizes.includes(baseSize)) return baseSize;
  return sizes[0] ?? baseSize;
}
