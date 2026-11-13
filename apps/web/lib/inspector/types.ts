/**
 * What the right inspector shows for a selection (plan v6 E3, decision 0147; `08` §5.3, e15–e26, e41).
 *
 * Plain data only: the server works it out (`garment.ts`, `elements.ts`, `product-info.ts`, which may
 * read the garment rules and so zod) and a client component draws it. Nothing in this file imports a
 * value, so a client component may import its types without carrying a schema into the browser
 * (`tests/architecture/client-weight.test.ts`).
 *
 * A change the inspector offers is carried as a raw design change (`change`), worked out on the server
 * by the same helpers the editor uses. The browser hands it back to the editor's own action
 * (`applyDesignActionAction`), which reads it as any browser change: it stamps `user-edited`, applies
 * it through the garment library, stores a version and runs `lib/validation` on it.
 */

/** A design change as the editor's action takes it. Opaque here: the server checks it again. */
export type DesignChange = Readonly<Record<string, unknown>>;

export type CheckTone = "ok" | "warn" | "bad";

export interface InspectorCheck {
  readonly key: string;
  readonly tone: CheckTone;
  readonly label: string;
  /** The panel or article the line is about, or null for the whole design. */
  readonly target: string | null;
  /** The rulebook entry behind the line, for its Why?; null on a passing line. */
  readonly ruleId: string | null;
}

export interface GarmentChecks {
  /** False when no validation result is stored for this version yet. */
  readonly checked: boolean;
  /** How many of the stored checks passed, and how many ran. */
  readonly passed: number;
  readonly total: number;
  /** "6 / 7", "Not checked yet". */
  readonly summary: string;
  /** Problems first (blockers, then warnings, then options no sample signed off), then the passing checks. */
  readonly lines: readonly InspectorCheck[];
  readonly blockers: number;
}

export interface InspectorOption {
  readonly code: string;
  readonly label: string;
  readonly chosen: boolean;
  readonly locked: boolean;
  readonly lockNote: string | null;
  readonly ruleId: string;
  readonly extraCost: string | null;
}

export interface InspectorOptionGroup {
  readonly group: string;
  readonly label: string;
  readonly options: readonly InspectorOption[];
}

export interface InspectorSlider {
  readonly key: string;
  readonly label: string;
  readonly min: number;
  readonly max: number;
  readonly step: number;
  readonly value: number;
  readonly unit: string;
  /** "+20 mm". */
  readonly valueText: string;
  /** "Range −30 to +40 mm". */
  readonly rangeText: string;
  readonly locked: boolean;
  readonly lockNote: string | null;
  readonly ruleId: string;
}

export interface InspectorColourRow {
  readonly id: string;
  readonly label: string;
  /** `#rrggbb`, or null when the part has no screen colour yet. */
  readonly hex: string | null;
  /** The free-text colour code, such as a Pantone name. */
  readonly code: string;
}

export interface StoredColourway {
  readonly id: string;
  readonly name: string;
  readonly colours: readonly Readonly<{ panelId: string; colour: string; swatch?: string }>[];
}

export interface PriceStepView {
  readonly qty: number;
  /** "£25.00", or null when no tier covers the quantity. */
  readonly unit: string | null;
}

export interface GarmentPrice {
  /** "From £22.00 · from 1 pc", or "Price not set yet". */
  readonly from: string;
  readonly steps: readonly PriceStepView[];
  /** The stored labels of the tiers the prices came from: every seeded price is a placeholder. */
  readonly labels: readonly string[];
  readonly priced: boolean;
}

export interface GarmentNamesNumbers {
  /** False when the garment has no place for names and numbers. */
  readonly available: boolean;
  readonly on: boolean;
  /** The lettering style chosen, as words, or null for "choose later". */
  readonly style: string | null;
  readonly styleId: string;
  readonly styles: readonly Readonly<{ id: string; label: string }>[];
  readonly colour: string;
  /** "PLAYER 10". */
  readonly sample: string;
  /** The changes that turn them on (with the usual places) and off; null where that is not possible. */
  readonly turnOn: DesignChange | null;
  readonly turnOff: DesignChange | null;
  /** The change that sets a lettering style, by style id, keeping everything else. */
  readonly withStyle: Readonly<Record<string, DesignChange>>;
}

/** One layer on a garment, listed in the inspector so it can be selected. */
export interface ElementSummary {
  readonly id: string;
  readonly kind: ElementKind;
  readonly name: string;
}

export type ElementKind = "text" | "image" | "illustration" | "player-mark";

export interface ElementView {
  readonly id: string;
  readonly kind: ElementKind;
  readonly name: string;
  /** The text itself, for a text layer. */
  readonly text: string | null;
  /** The lettering style as words, for text and player marks. */
  readonly lettering: string | null;
  /** "Front", "Back, Sleeve L". */
  readonly views: string;
  /** "Zone: chest" or "Anchor: left-chest on body-front". */
  readonly placement: string | null;
  /** Offset from the placement, in millimetres. */
  readonly offset: Readonly<{ x: number; y: number }> | null;
  readonly widthMm: number | null;
  readonly heightMm: number | null;
  readonly rotationDeg: number | null;
  /** Layer opacity, 0–100. */
  readonly opacity: number;
  readonly blend: string;
  /** "Sublimation" (the default) or the technique chosen. */
  readonly printType: string;
  readonly colours: readonly InspectorColourRow[];
}

export interface ProductInfo {
  readonly name: string;
  /** "JSY-SS-01 · Knitwright Sialkot · Class A". */
  readonly line: string;
  readonly cost: Readonly<{ amount: string; note: string }>;
  readonly shipping: Readonly<{ amount: string; note: string }>;
  readonly printArea: Readonly<{ amount: string; note: string }>;
  readonly file: Readonly<{ amount: string; note: string }>;
  readonly guidelines: readonly string[];
  /** The free drawing of the design's front, as SVG: what a person draws their artwork against. */
  readonly templateHref: string;
}

export interface GarmentInspectorView {
  readonly designId: string;
  readonly name: string;
  readonly version: number;
  readonly product: Readonly<{
    name: string;
    /** "JSY-SS-01 · Class A · F-POLY-INT 150 gsm", or why there is no base article. */
    line: string;
    hasArticle: boolean;
  }>;
  readonly options: Readonly<{
    groups: readonly InspectorOptionGroup[];
    sliders: readonly InspectorSlider[];
    /** Why there are no options to show, or null. */
    empty: string | null;
  }>;
  readonly colourways: Readonly<{
    choices: readonly Readonly<{ id: string; name: string; selected: boolean }>[];
    /** The change that adds the next kit colourway (Home, Away, GK…). */
    add: DesignChange;
  }>;
  readonly kitColours: readonly InspectorColourRow[];
  /** The colourway shown, as stored, so a swatch change can be sent as the whole colourway (`edits.ts`). */
  readonly colourway: StoredColourway;
  readonly namesNumbers: GarmentNamesNumbers;
  readonly sizes: Readonly<{ sizes: readonly string[]; base: string | null }>;
  readonly checks: GarmentChecks;
  readonly price: GarmentPrice;
  readonly elements: readonly ElementSummary[];
  readonly elementViews: Readonly<Record<string, ElementView>>;
  readonly productInfo: ProductInfo;
  /** The base article reference stored on the design, which a slider change replaces whole. */
  readonly article: Readonly<{ baseArticleCode: string; productionClass: "A" | "B"; parameters: Readonly<Record<string, number | string | boolean>> }> | null;
}
