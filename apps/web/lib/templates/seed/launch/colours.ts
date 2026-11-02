import { CLUB_PALETTE } from "@/lib/kit-styles/presets";

/**
 * The colours the launch starters are built from. Every one is read from `CLUB_PALETTE`, the palette
 * the editor itself offers (`lib/kit-styles/presets.ts`), so a starter can only be in a colour a
 * person can pick. These are screen colours: the colour reference a factory matches is still the
 * brand's to give.
 */
export function paletteColour(name: string): string {
  const found = CLUB_PALETTE.find((entry) => entry.name === name);
  if (!found) throw new Error(`"${name}" is not a colour of the editor's palette.`);
  return found.swatch;
}

export const NAVY = paletteColour("Navy");
export const ROYAL = paletteColour("Royal blue");
export const SKY = paletteColour("Sky blue");
export const RED = paletteColour("Red");
export const MAROON = paletteColour("Maroon");
export const GREEN = paletteColour("Green");
export const BOTTLE = paletteColour("Bottle green");
export const GOLD = paletteColour("Gold");
export const YELLOW = paletteColour("Yellow");
export const ORANGE = paletteColour("Orange");
export const PURPLE = paletteColour("Purple");
export const BLACK = paletteColour("Black");
export const WHITE = paletteColour("White");
export const GREY = paletteColour("Grey");
