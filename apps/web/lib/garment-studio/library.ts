import type { BrandRecord } from "@/lib/brand-studio/types";
import type { EditorDesign } from "@/lib/editor/slots";
import { libraryGroups, type LibraryItem, type LibrarySection } from "@/lib/panel-layers/library";
import { PALETTE_RULE_ID } from "@/lib/panel-layers/palettes";

/**
 * WHAT THE STUDIO'S LIBRARY PANELS LIST (plan v6 G1, decision 0150; `08` v3.6, s02, s04–s07).
 *
 * The lists are the Library toolbar's own (Y3, decision 0076): the base article's approved fabrics,
 * the seeded print-safe palettes, the pattern fills the platform can draw. Applying an item goes
 * through the same `applyItem` steps, so a studio panel can never put on a design anything the
 * toolbar could not. The club's own palettes and uploads come from Brand Studio's record, read on
 * the server; nothing here fetches.
 */

/** Fabra's filter chips over the fabric list. Each matches the words the fabric's own card holds. */
export const FABRIC_CHIPS: readonly string[] = ["Polyester", "Mesh", "Interlock", "Recycled"];

/** The words a fabric is found by: its name, its code and every line of its card. */
const words = (item: LibraryItem): string => [item.label, item.code ?? "", ...item.card.map((line) => line.value)].join(" ").toLowerCase();

/** One section of the Library toolbar's data by id. Every id used here exists; a test holds that. */
export function librarySection(design: EditorDesign, id: string): LibrarySection {
  const found = libraryGroups(design)
    .flatMap((group) => group.sections)
    .find((section) => section.id === id);
  return found as LibrarySection;
}

/** The fabrics that match the search box and the chosen chip, both case-blind. */
export function filterFabrics(items: readonly LibraryItem[], query: string, chip: string | null): readonly LibraryItem[] {
  const wanted = [query.trim().toLowerCase(), chip?.toLowerCase() ?? ""].filter((term) => term !== "");
  return items.filter((item) => wanted.every((term) => words(item).includes(term)));
}

/** The approved pattern-fill options come first in the toolbar's list; Fabra calls them repeats. */
export const isApprovedRepeat = (item: LibraryItem): boolean => item.apply.kind === "option";

/** What the club's library holds, cut down to what the studio draws. Built on the server. */
export interface ClubLibrary {
  readonly name: string;
  readonly palettes: readonly Readonly<{ id: string; name: string; colours: readonly LibraryItem[] }>[];
  readonly uploads: readonly Readonly<{ id: string; label: string; kind: string }>[];
}

/** A brand colour as a library item, so it is applied by the same steps as a print-safe one. */
const brandColour = (colour: Readonly<{ id: string; name: string; hex: string; pantoneTcx: string | null }>): LibraryItem => ({
  id: `brand-${colour.id}`,
  kind: "colour",
  label: colour.name,
  code: colour.pantoneTcx,
  swatch: colour.hex,
  card: [{ label: "Screen colour", value: colour.hex }, ...(colour.pantoneTcx ? [{ label: "Pantone TCX", value: colour.pantoneTcx }] : [])],
  ruleId: PALETTE_RULE_ID,
  apply: { kind: "colour", colour: colour.pantoneTcx ?? "", swatch: colour.hex },
});

/** The club library from Brand Studio's record, or an empty one under the brand's name when it could not be read. */
export function clubLibrary(record: BrandRecord | null, brandName: string): ClubLibrary {
  if (record === null) return { name: brandName, palettes: [], uploads: [] };
  return {
    name: record.brandName || brandName,
    palettes: record.palettes.map((palette) => ({ id: palette.id, name: palette.name, colours: palette.colours.map(brandColour) })),
    uploads: record.assets.map((asset) => ({ id: asset.id, label: asset.label, kind: asset.kind })),
  };
}

/** The club's initials for its avatar: the first letters of up to two words. */
export function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter((part) => /[a-z0-9]/i.test(part))
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
  return letters || "?";
}
