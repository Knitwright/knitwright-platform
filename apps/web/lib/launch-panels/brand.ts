/**
 * The brand's palettes, type styles and voice, as the launch rail's Brand panel shows them (plan
 * v5, decision 0106; spec Launch shell, "Brand", and F-S9).
 *
 * Every row here is built by Y6's own functions -- `brandTabColours` and `brandTabFonts`, the pair
 * that already turn a `BrandRecord` into the shapes the shared Brand tab takes. So the sublimation
 * estimate and the licence note beside a font are worked out in one place, on the server, and this
 * panel states no print fact and no licence of its own.
 *
 * **Only a font whose licence is in this repository may be set at all** (decision 0079: the
 * database itself holds `check (selectable = (licence = 'bundled'))`). A row the brand holds no
 * licence for is shown with its own licence note and is not offered, rather than being left out as
 * though the brand had not chosen it.
 */

import { brandTabColours, brandTabFonts } from "@/lib/brand-studio/brand-tab";
import type { BrandRecord, KitFont } from "@/lib/brand-studio/types";
import { STYLE_FIELDS, STYLE_LABELS, VOICE_TAG_LABELS } from "@/lib/brand-studio/words";
import type { BrandPaletteRow, BrandView } from "./view";

/** One palette's own colours, each with the estimate's answer already worked out. */
const paletteRow = (record: BrandRecord, paletteId: string): BrandPaletteRow => {
  const palette = record.palettes.find((one) => one.id === paletteId);
  return {
    id: paletteId,
    name: palette?.name ?? "",
    colours: palette === undefined ? [] : brandTabColours([palette]),
  };
};

/** The three F-S9 texts the brand has actually written. An empty text is left out, never guessed. */
const styleRows = (record: BrandRecord): readonly Readonly<{ label: string; text: string }>[] =>
  STYLE_FIELDS.flatMap((field) => {
    const text = record.profile.style[field].trim();
    return text === "" ? [] : [{ label: STYLE_LABELS[field], text }];
  });

/** Everything the Brand panel shows for one brand. */
export function brandView(record: BrandRecord, kitFonts: readonly KitFont[]): BrandView {
  const fonts = brandTabFonts(record.fonts, kitFonts);
  return {
    brandName: record.brandName,
    palettes: record.palettes.map((palette) => paletteRow(record, palette.id)).filter((row) => row.colours.length > 0),
    fonts,
    voice: record.profile.voiceTags.map((tag) => VOICE_TAG_LABELS[tag]),
    style: styleRows(record),
    anyFontSelectable: fonts.some((font) => font.selectable),
  };
}
