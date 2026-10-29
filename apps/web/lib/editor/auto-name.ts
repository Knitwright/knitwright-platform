import type { BaseArticle } from "@/lib/catalogue";
import { optionGroups, parameterSliders, signedMm } from "./form";
import type { FormValues } from "./slots";

/**
 * The name a design takes from its form (spec F-S4: "Crew neck · Coverstitch sleeve · +20 mm
 * length"): each chosen option, then every parameter away from the article's own default. The
 * catalogue's option labels carry the whole specification ("Crew neck, 1x1 rib, 20 mm finished"),
 * so the name uses the first clause of each, which is the part a person reads.
 *
 * The design's own name, typed when it was created, is what the heading shows; this is the line
 * under it, so a person can see what the form says without opening the toolbar.
 */

const SEPARATOR = " · ";

/** The first clause of an option label: "Crew neck, 1x1 rib, 20 mm finished" is "Crew neck". */
export const shortLabel = (label: string): string => (label.split(",")[0] ?? label).trim();

/** The form as one line, or null for a design with no base article: nothing is invented for it. */
export function autoDesignName(article: BaseArticle | null, form: FormValues): string | null {
  if (!article) return null;
  const parts: string[] = [];
  for (const group of optionGroups(article, form)) {
    const tile = group.tiles.find((entry) => entry.chosen);
    if (tile) parts.push(shortLabel(tile.label));
  }
  for (const slider of parameterSliders(article, form)) {
    if (slider.value !== slider.defaultMm) parts.push(`${slider.label} ${signedMm(slider.value)}`);
  }
  return parts.length === 0 ? null : parts.join(SEPARATOR);
}
