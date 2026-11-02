/**
 * What the four rail panels show, worked out on the server so the component decides nothing
 * (plan v5, decision 0108). The same arrangement as L7's `lib/brand-studio/import/view.ts`, and for
 * the same reason: a panel that computes nothing cannot compute something different from the page.
 *
 * **No zod and nothing that reaches it.** `tests/architecture/client-weight.test.ts` refuses a
 * client component whose imports reach zod, and the filter functions L8 left ready for this panel
 * (`matchesTags`, `matchesSearch`, `TAG_CHOICES`, `gapForType`) reach it through `lib/garment` and
 * `lib/catalogue`. So the filtering happens on the server, with L8's own functions, and this file
 * holds only the shapes it hands over -- rather than a second filter being written for the browser.
 */

import { formatDate } from "@/lib/projects/dates";
import type { BrandTabColour, BrandTabFont } from "@/components/brand-studio/BrandTab";
import { SHOWN_PER_COLLECTION } from "./words";

/** A note that explains itself: every one carries the rule behind it, or `R-GAP-000`. */
export interface PanelNote {
  readonly ruleId: string;
  readonly line: string;
}

/* ---------------------------------------------------------------------------------------------
 * Templates.
 */

/** One choice of one tag group, with how many of the templates read carry it. */
export interface TagCount {
  readonly id: string;
  readonly label: string;
  readonly count: number;
}

/** One tag group of `07`'s launch tag set, as the panel draws its row of chips. */
export interface TagFilterGroup {
  readonly group: string;
  readonly label: string;
  readonly choices: readonly TagCount[];
}

/** One template's card. Nothing on it is worked out in the browser. */
export interface TemplateCard {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  /** The collection it is filed under: its sport group, in words. */
  readonly collection: string;
  /** The garment it is drawn on, by the catalogue's own name for it. */
  readonly articleLabel: string;
  /** What the screen may say about this template's review, from `REVIEW_LABELS`. */
  readonly reviewLabel: string;
  /** The designer's name, for a template a designer made. */
  readonly attribution: string | null;
  /** What the article behind it has no data for, so the card says it rather than looking ready. */
  readonly gap: PanelNote | null;
}

/** One collection of the library: a sport group, shown short with a Show all. */
export interface TemplateCollection {
  readonly key: string;
  readonly label: string;
  readonly shown: readonly TemplateCard[];
  /** How many more the collection holds than are shown. */
  readonly hidden: number;
}

export interface TemplatesView {
  /** The cards that matched, in the library's own fixed order. The panel groups them itself. */
  readonly cards: readonly TemplateCard[];
  /** Every template of the kinds this panel renders, before the search and the filters. */
  readonly total: number;
  readonly filters: readonly TagFilterGroup[];
  /** The template kinds the read asked the database for, so the panel can say what it is showing. */
  readonly kinds: readonly string[];
}

/** The groups of one page of cards, each cut to `SHOWN_PER_COLLECTION` unless it is expanded. */
export function collectionsOf(cards: readonly TemplateCard[], expanded: readonly string[]): readonly TemplateCollection[] {
  const keys = [...new Set(cards.map((card) => card.collection))];
  return keys.map((key) => {
    const all = cards.filter((card) => card.collection === key);
    const open = expanded.includes(key);
    return { key, label: key, shown: open ? all : all.slice(0, SHOWN_PER_COLLECTION), hidden: open ? 0 : Math.max(0, all.length - SHOWN_PER_COLLECTION) };
  });
}

/* ---------------------------------------------------------------------------------------------
 * Uploads.
 */

/**
 * What one upload records about rights: who said it, when, and the version of the words they saw.
 * That is the whole of what `user_artworks` holds, and the panel shows exactly that.
 */
export interface UploadRights {
  readonly whenIso: string;
  /** The day, as people read it. */
  readonly when: string;
  readonly wordingVersion: string;
  /** The words that were on screen, when this repository still holds that version. Else null. */
  readonly wordingText: string | null;
}

export interface UploadRow {
  readonly id: string;
  readonly label: string;
  /** "Drawing" or "Picture": a vector or a raster, in words rather than in a word nobody says. */
  readonly kindLabel: string;
  /** "PNG, 1200 × 1200 px". */
  readonly detail: string;
  readonly rights: UploadRights;
  /** What the upload itself recorded as a warning, in its own words. */
  readonly warnings: readonly string[];
}

export interface UploadsView {
  readonly rows: readonly UploadRow[];
  readonly total: number;
}

/** The day a stored timestamp falls on, or an empty string when the stamp cannot be read. */
export const dayOf = (iso: string): string => formatDate(iso);

/* ---------------------------------------------------------------------------------------------
 * Brand.
 */

export interface BrandPaletteRow {
  readonly id: string;
  readonly name: string;
  readonly colours: readonly BrandTabColour[];
}

export interface BrandView {
  readonly brandName: string;
  readonly palettes: readonly BrandPaletteRow[];
  readonly fonts: readonly BrandTabFont[];
  /** The brand's voice words, as Brand Studio's own short list spells them. */
  readonly voice: readonly string[];
  /** The three F-S9 texts, each with its own heading. An empty text is left out. */
  readonly style: readonly Readonly<{ label: string; text: string }>[];
  /** True when the brand holds a licence for at least one of the type styles shown. */
  readonly anyFontSelectable: boolean;
}

/** True when there is nothing of the brand to show at all, so the panel draws its empty state. */
export const brandIsEmpty = (view: BrandView): boolean =>
  view.palettes.length === 0 && view.fonts.length === 0 && view.voice.length === 0 && view.style.length === 0;

export type { BrandTabColour, BrandTabFont };
