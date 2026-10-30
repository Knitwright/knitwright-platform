import type { OutputKind } from "@/lib/credits/kinds";
import type { View } from "@/lib/flat/model";
import { TECH_PACK_TABS, type TabId } from "./tabs";

/**
 * THE EXPORT PANEL (spec F-S6 "Export panel"; plan v5 Y5, decision 0078).
 *
 * The panel's own choices, kept apart from the screen: which tabs it has, what each one offers,
 * and what each one would produce. The component holds markup and wiring only, and nothing here
 * imports the code that makes a file, so opening the panel does not pull a PDF writer into the
 * page (decision 0011).
 *
 * An output the platform cannot make yet says so in its own words and offers no address, so the
 * panel never shows a button that would fail.
 */

export const EXPORT_PANEL_TABS = ["tech-pack", "images", "pattern", "print-files", "production-package", "mockups"] as const;
export type ExportPanelTabId = (typeof EXPORT_PANEL_TABS)[number];

/** What a tab costs, in the words the specification uses. */
export type Charge = "free" | "credits" | "with-the-order";

export interface ExportPanelTab {
  readonly id: ExportPanelTabId;
  readonly label: string;
  readonly lead: string;
  readonly charge: Charge;
  /** The credit kind the meter charges, or null for a tab that costs nothing. */
  readonly kind: OutputKind | null;
}

export const PANEL_TABS: readonly ExportPanelTab[] = [
  {
    id: "tech-pack",
    label: "Tech pack",
    lead: "The tech pack as a PDF of the specification's sixteen pages, and as an Excel file with one sheet per tab.",
    charge: "free",
    kind: null,
  },
  {
    id: "images",
    label: "Images",
    lead: "Views of the garment, drawn from the design itself, so the same design gives the same picture.",
    charge: "free",
    kind: null,
  },
  {
    id: "pattern",
    label: "Pattern",
    lead: "The pattern pieces to cut from, at full size.",
    charge: "credits",
    kind: "pattern_file",
  },
  {
    id: "print-files",
    label: "Print files",
    lead: "One file for every piece in every size, with the bleed a printer needs.",
    charge: "credits",
    kind: "pattern_file",
  },
  {
    id: "production-package",
    label: "Production package",
    lead: "Everything a factory needs to make this version, as one zip with a manifest.",
    charge: "with-the-order",
    kind: null,
  },
  {
    id: "mockups",
    label: "Mockups & media",
    lead: "On-model, lifestyle and flat-lay pictures, in the marketing media screen.",
    charge: "credits",
    kind: "marketing_media",
  },
];

export const CHARGE_WORDS: Readonly<Record<Charge, string>> = {
  free: "Free.",
  credits: "Costs credits once charging is switched on.",
  "with-the-order": "Included when Knitwright makes the garment; charged if you take it elsewhere.",
};

/** One file the panel can ask for, or one it cannot make yet and says so. */
export interface ExportOutput {
  readonly id: string;
  readonly label: string;
  /** The address that builds and sends the file, or null when the platform cannot make it yet. */
  readonly address: string | null;
  /** Why there is no file yet, in plain words, or null. */
  readonly notYet: string | null;
}

/** The sections of the tech pack a person may choose, which are the tabs of the tech pack view. */
export const TECH_PACK_SECTIONS: readonly Readonly<{ id: TabId; label: string }>[] = TECH_PACK_TABS.filter(
  (tab) => tab.id !== "review",
).map((tab) => ({ id: tab.id, label: tab.sheet }));

export const IMAGE_VIEWS = ["front", "back", "left", "right", "all"] as const;
export type ImageView = (typeof IMAGE_VIEWS)[number];

/** SVG is what the platform draws today; PNG and JPG are what the specification also asks for. */
export const IMAGE_TYPES = ["svg", "png", "jpg"] as const;
export type ImageType = (typeof IMAGE_TYPES)[number];

/** The sizes the panel offers, in pixels on the longest side. The middle one is the one to use. */
export const IMAGE_SIZES = [600, 1200, 2048] as const;
export const RECOMMENDED_IMAGE_SIZE = 1200;
export const RECOMMENDED_NOTE = "Recommended for manufacturing and for Instagram.";

export const PATTERN_FORMATS = ["dxf-aama", "pdf-1-1", "svg", "png"] as const;
export type PatternFormat = (typeof PATTERN_FORMATS)[number];

export const PATTERN_FORMAT_LABELS: Readonly<Record<PatternFormat, string>> = {
  "dxf-aama": "DXF-AAMA",
  "pdf-1-1": "PDF at full size",
  svg: "SVG",
  png: "PNG",
};

/** The print files the platform makes today: PDF/X-4 at 150 DPI with 10 mm bleed, and SVG beside it. */
export const PRINT_FILE_NOTE = "PDF/X-4 at 150 DPI with 10 mm of bleed, one file per piece per size. The zip is made when you ask for it and is not kept.";

export interface PanelInput {
  readonly projectId: string;
  readonly version: number;
  readonly colourwayId: string;
  /** The size the editor is showing, which the print files are made for. */
  readonly size: string;
  /** The views the design has a drawing for. Nothing else can be pictured. */
  readonly views: readonly View[];
}

export interface ImageOptions {
  readonly view: ImageView;
  readonly type: ImageType;
  readonly size: number;
  readonly withMannequin: boolean;
  readonly withBackground: boolean;
}

export interface PatternOptions {
  readonly format: PatternFormat;
  readonly withArtwork: boolean;
  readonly withMeasurements: boolean;
}
