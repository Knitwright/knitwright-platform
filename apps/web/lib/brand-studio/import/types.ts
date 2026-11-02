/**
 * The shapes one brand import produces (spec F-S9, plan v5 L7, decision 0102). No zod and no
 * `sharp` here, so the screen can import them (tests/architecture/client-weight.test.ts).
 *
 * **Read this before adding a field.** Every shape below is plain, serialisable data: a number, a
 * string, a colour, a decision. Not one of them may ever hold a picture's bytes, a page's markup or
 * a base64 blob, because a proposal travels to the browser and back. `persistence.test.ts` walks
 * these shapes and fails on anything that looks like either, which is the test the spec rule
 * "no third-party HTML or image is ever stored" rests on.
 */

import type { FontRole, StyleField } from "../words";
import type { Decision, ImportStage, ItemKind, RefusalReason } from "./words";

/** Why a candidate was picked out of the page, so a person can see what we read and why. */
export type Why =
  | "favicon"
  | "apple-touch-icon"
  | "manifest-icon"
  | "og-image"
  | "img-logo"
  | "img-product"
  | "link-image"
  | "css-colour"
  | "css-font"
  | "inline-font";

/** One address the page pointed at. Absolute, https, and on the site's own host. */
export interface Candidate {
  readonly url: string;
  readonly why: Why;
  /** The page's own alt text or title for it, as words. Null when it gave none. */
  readonly alt: string | null;
}

/**
 * What one page pointed at, worked out from its markup and then kept while the markup is dropped.
 * There is no `html` field and there never may be.
 */
export interface PageLinks {
  readonly icons: readonly Candidate[];
  readonly logos: readonly Candidate[];
  readonly pictures: readonly Candidate[];
  /** `#rrggbb`, lower case, in the order first met in the page's own styles. */
  readonly cssColours: readonly string[];
  /** Font family names the page asked for, as written, in the order first met. */
  readonly fontFamilies: readonly string[];
}

/** One page of the brand's own site, as words and addresses. The markup is already gone. */
export interface SiteSource {
  readonly url: string;
  readonly host: string;
  readonly title: string | null;
  /** The page's plain words, for the stub's own use. Never stored and never shown. */
  readonly words: string;
  readonly links: PageLinks;
  readonly fetchedAt: string;
}

/** What one picture turned out to be. Its bytes were read, measured and dropped. */
export interface PictureFacts {
  readonly url: string;
  readonly why: Why;
  readonly alt: string | null;
  /** `image/png`, `image/jpeg`, `image/webp` or `image/svg+xml`. */
  readonly contentType: string;
  readonly widthPx: number;
  readonly heightPx: number;
  readonly bytes: number;
  /** The colours the picture is made of, dominant first. Worked out by `lib/colour/palette.ts`. */
  readonly swatches: readonly Readonly<{ hex: string; share: number }>[];
}

/** One colour an import proposes, with what the sublimation estimate says about it. */
export interface ImportedColour {
  readonly hex: string;
  /** The nearest colour the sublimation estimate accepts. The same colour when it already is. */
  readonly safeHex: string;
  readonly inGamut: boolean;
  /** CIE76 difference between `hex` and `safeHex`, two decimals. 0 when nothing changed. */
  readonly deltaE: number;
  /** Where in the page it came from, in words. */
  readonly from: string;
  /** How much of the page's pictures hold it, 0 to 1, or null when it came from a stylesheet. */
  readonly share: number | null;
  /** No Pantone data ships, so this is always null on an import. A person types their own. */
  readonly pantoneTcx: null;
  readonly notes: readonly ImportNote[];
}

/** One font an import proposes for one role, and the plain truth about the match. */
export interface ImportedFont {
  readonly role: FontRole;
  /** The family the page asked for, as written. Null when the page named none. */
  readonly wanted: string | null;
  /** A key of `brand_studio_fonts` whose licence is in this repository, or null when none fits. */
  readonly fontKey: string | null;
  readonly fontLabel: string | null;
  /** True only when the page's own family is itself a font Knitwright may use. */
  readonly isSameFont: boolean;
  readonly notes: readonly ImportNote[];
}

/** The three F-S9 texts, written from the brand's own pictures. Words only: never pixels. */
export type ImportedStyle = Readonly<Record<StyleField, string>>;

/** A note beside an imported value. Every one carries the rule that explains it. */
export interface ImportNote {
  readonly ruleId: string;
  readonly severity: "warning" | "note";
  readonly message: string;
}

/** One thing the person says yes or no to. Nothing is taken in until they do. */
export interface ImportItem {
  readonly id: string;
  readonly kind: ItemKind;
  readonly label: string;
  /** The second line of the row: the size, the hex, the family, the word count. */
  readonly detail: string;
  readonly decision: Decision;
  readonly notes: readonly ImportNote[];
}

/** How one stage of the run went. A failed stage never fails the import. */
export interface StageReport {
  readonly stage: ImportStage;
  readonly status: "pending" | "running" | "done" | "empty" | "skipped" | "failed";
  /** How many things it produced. Null before it has run. */
  readonly found: number | null;
  /** Why it is `empty`, `skipped` or `failed`, in words. Null otherwise. */
  readonly because: string | null;
  readonly tookMs: number | null;
}

/** The tick beside the pictures, and what it is a tick against. Never ticked for the person. */
export interface RightsTick {
  readonly ticked: false | true;
  readonly wordingVersion: string;
  readonly text: string;
  readonly ask: string;
}

/** Everything one import found, and what the person has said about each piece of it. */
export interface ImportProposal {
  readonly url: string;
  readonly host: string;
  readonly fetchedAt: string;
  readonly stages: readonly StageReport[];
  readonly items: readonly ImportItem[];
  readonly colours: readonly ImportedColour[];
  readonly fonts: readonly ImportedFont[];
  readonly logos: readonly PictureFacts[];
  readonly graphics: readonly PictureFacts[];
  readonly style: ImportedStyle | null;
  readonly rights: RightsTick;
  /** Which writer wrote the style: "stub", or a model id. Kept so a reader knows what wrote it. */
  readonly styleWriter: string | null;
}

/** An import that could not start, with the reason and what to do about it. */
export interface ImportRefusal {
  readonly reason: RefusalReason;
  readonly message: string;
  readonly canRetry: boolean;
}

export type ImportOutcome = Readonly<{ ok: true; proposal: ImportProposal }> | Readonly<{ ok: false; refusal: ImportRefusal }>;

/**
 * What the apply step asks the storage layer for: one picture of the brand's own, to be fetched
 * once more and handed straight to `lib/storage/store.ts`. It carries no bytes, and it exists only
 * for an item the person accepted **and** ticked the rights box for.
 */
export interface UploadIntent {
  readonly url: string;
  readonly assetKind: "logo" | "graphic";
  readonly label: string;
  readonly contentType: string;
  /** The person who ticked, when they ticked, and the version of the words they saw. */
  readonly rights: Readonly<{ confirmedBy: string; confirmedAt: string; wordingVersion: string }>;
}

export type { Decision, ImportStage, ItemKind, RefusalReason };
