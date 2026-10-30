/**
 * The rows the shared `<BrandTab>` takes (components/brand-studio/BrandTab.tsx).
 *
 * Y3's Library toolbar, Y8's names and numbers and the wave 4 launch editor all need a Brand tab
 * in their colour and font pickers (spec F-S9). They read a `BrandRecord` with
 * `lib/brand-studio/service.ts` and turn it into rows here, so the sublimation estimate is worked
 * out in one place, on the server, and no picker computes a colour of its own.
 */

import type { BrandTabColour, BrandTabFont } from "@/components/brand-studio/BrandTab";
import { colourViews } from "./colours";
import type { BrandPalette, FontChoice, KitFont } from "./types";
import { FONT_ROLE_LABELS, FONT_ROLES } from "./words";

export type { BrandTabColour, BrandTabFont };

/** Every brand colour, grouped by palette, each with the estimate's answer already worked out. */
export const brandTabColours = (palettes: readonly BrandPalette[]): readonly BrandTabColour[] =>
  colourViews(palettes).map((view) => ({
    key: view.id,
    name: view.name,
    paletteName: view.paletteName,
    hex: view.hex,
    safeHex: view.safeHex,
    inGamut: view.inGamut,
    pantoneTcx: view.pantoneTcx,
    warning: view.findings.find((finding) => finding.code === "gamut-estimate")?.message ?? null,
  }));

/**
 * The font set for each role of F-S9, in the spec's order. A role with no font chosen is left out:
 * a picker offers what the brand has, not a guess.
 */
export const brandTabFonts = (fonts: readonly FontChoice[], kitFonts: readonly KitFont[]): readonly BrandTabFont[] =>
  FONT_ROLES.flatMap((role) => {
    const chosen = fonts.find((font) => font.role === role)?.fontKey ?? null;
    const kitFont = kitFonts.find((font) => font.key === chosen);
    return kitFont === undefined
      ? []
      : [
          {
            key: `${role}:${kitFont.key}`,
            label: kitFont.label,
            roleLabel: FONT_ROLE_LABELS[role],
            family: kitFont.family === "" ? null : kitFont.family,
            licence: kitFont.licence,
            licenceNote: kitFont.licenceNote,
            selectable: kitFont.selectable,
          },
        ];
  });

/** The whole licensed kit-font list, for a picker that lets a brand choose rather than apply. */
export const kitFontRows = (kitFonts: readonly KitFont[]): readonly BrandTabFont[] =>
  kitFonts.map((font) => ({
    key: font.key,
    label: font.label,
    roleLabel: null,
    family: font.family === "" ? null : font.family,
    licence: font.licence,
    licenceNote: font.licenceNote,
    selectable: font.selectable,
  }));
