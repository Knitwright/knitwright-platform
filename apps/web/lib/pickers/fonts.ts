/**
 * THE FONT PICKER'S LIST (plan v6 E5, decision 0149; `08` v3.7 "Font picker", §5.7 "Font panel",
 * prototype e32).
 *
 * The **Fonts** tab is the platform's licensed kit-font list (`brand_studio_fonts`, decision 0079);
 * the **Brand** tab is the fonts the brand chose for each role. Both arrive in the shape Brand Studio's
 * own Brand tab already takes (`BrandTabFont`, `lib/brand-studio/brand-tab.ts`), so the licence note
 * beside a font is worked out once, on the server.
 *
 * **A filter chip exists only for a tag some font carries.** Kittl's chips (Kit-safe, Sports, Varsity,
 * Serif…) are categories, and KIT-SAFE is a print claim: neither is in the font list yet, so the
 * picker shows "All" until the list carries them (owner question 1 of 0149). Nothing is tagged by
 * guessing from a name.
 */

export interface FontRow {
  readonly key: string;
  readonly label: string;
  /** The role it is set for, on the Brand tab ("Headline"), else null. */
  readonly roleLabel: string | null;
  /** A CSS font family to preview it in, or null when there is no face to show. */
  readonly family: string | null;
  readonly licenceNote: string;
  /** Only a font whose licence is on file may be chosen. */
  readonly selectable: boolean;
  /** Categories the list gives this font. Empty until the list carries them. */
  readonly tags?: readonly string[];
  /** True only when the list says the font holds up when sublimated, embroidered or pressed small. */
  readonly kitSafe?: boolean;
}

export const ALL_FONTS = "all";
export const KIT_SAFE = "kit-safe";

export interface FontChip {
  readonly id: string;
  readonly label: string;
}

const title = (tag: string): string => tag.replace(/[-_]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());

/** The chips for a list: All, then Kit-safe if any font is, then each tag in the order first seen. */
export function chipsFor(rows: readonly FontRow[]): readonly FontChip[] {
  const tags = [...new Set(rows.flatMap((row) => row.tags ?? []))];
  return [
    { id: ALL_FONTS, label: "All" },
    ...(rows.some((row) => row.kitSafe === true) ? [{ id: KIT_SAFE, label: "Kit-safe" }] : []),
    ...tags.map((tag) => ({ id: tag, label: title(tag) })),
  ];
}

/** The fonts a chip and a search leave. */
export function filterFonts(rows: readonly FontRow[], chip: string, query: string): readonly FontRow[] {
  const words = query.trim().toLowerCase();
  return rows.filter((row) => {
    if (chip === KIT_SAFE && row.kitSafe !== true) return false;
    if (chip !== ALL_FONTS && chip !== KIT_SAFE && !(row.tags ?? []).includes(chip)) return false;
    return words === "" || `${row.label} ${row.roleLabel ?? ""}`.toLowerCase().includes(words);
  });
}

/** Why a row cannot be picked, for its tooltip, or null when it can. */
export const unpickableReason = (row: FontRow): string | null => (row.selectable ? null : row.licenceNote);
