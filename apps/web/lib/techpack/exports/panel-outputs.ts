import type { View } from "@/lib/flat/model";
import { TECH_PACK_PAGES } from "./pages";
import { TECH_PACK_TABS } from "./tabs";
import type { ExportOutput, ExportPanelTabId, ImageOptions, PanelInput, PatternOptions } from "./panel";

/**
 * What each tab of the Export panel would produce, and the address that produces it (decision
 * 0078). An output the platform cannot make yet carries no address and says in its own words why,
 * so the panel never draws a button that would fail and never implies a file exists.
 *
 * Every control of the panel changes what this returns. There is no setting here that the person
 * can move without the answer changing, because a control that changes nothing is a claim the
 * platform cannot keep.
 */

/** The address of the project's export route for one format. */
const exportAddress = (input: PanelInput, format: "pdf" | "xlsx" | "svg", extra: readonly string[] = []): string => {
  const query = [`version=${input.version}`, `colourway=${encodeURIComponent(input.colourwayId)}`, ...extra];
  return `/api/projects/${encodeURIComponent(input.projectId)}/exports/${format}?${query.join("&")}`;
};

/** The address of the print-files route, which makes one zip of pieces. */
const printAddress = (input: PanelInput, formats: readonly string[], size: string | null): string => {
  const query = [
    `formats=${formats.join(",")}`,
    `colourway=${encodeURIComponent(input.colourwayId)}`,
    ...(size === null ? [] : [`size=${encodeURIComponent(size)}`]),
  ];
  return `/api/projects/${encodeURIComponent(input.projectId)}/print-files?${query.join("&")}`;
};

/** The marketing media screen, which the Mockups tab opens until the launch studio lands (wave 4). */
export const mockupsAddress = (input: PanelInput): string => `/studio/${encodeURIComponent(input.projectId)}?tool=media`;

/** The pattern page, where a pattern is asked for and its DXF is kept. */
const patternPage = (input: PanelInput): string => `/studio/${encodeURIComponent(input.projectId)}/pattern-service`;

export const EVERY_SECTION_NOTE = "Both files carry every section. Leaving one out is coming.";

const ready = (id: string, label: string, address: string): ExportOutput => ({ id, label, address, notYet: null });
const notYet = (id: string, label: string, reason: string): ExportOutput => ({ id, label, address: null, notYet: reason });

/** The PDF of the sixteen pages, and the Excel file of the eleven sheets. */
export const techPackOutputs = (input: PanelInput): readonly ExportOutput[] => [
  ready("pdf", `PDF, ${TECH_PACK_PAGES.length} pages`, exportAddress(input, "pdf")),
  ready("xlsx", `Excel, ${TECH_PACK_TABS.length} sheets`, exportAddress(input, "xlsx")),
];

const NO_SIDE_VIEW = "This garment is drawn from the front and the back only, so there is no side view to send.";
const NO_RASTER = "The drawing is sent as an SVG, which is to scale and opens in any browser. PNG and JPG at a chosen size are not made yet.";
const NO_MANNEQUIN = "A drawing has no mannequin and no background, so those are not in this file.";

const VIEW_LABELS: Readonly<Record<View, string>> = { front: "Front", back: "Back" };

const drawnViews = (input: PanelInput, view: ImageOptions["view"]): readonly View[] => {
  if (view === "all") return input.views;
  return input.views.filter((drawn) => drawn === view);
};

/**
 * The views of the garment, drawn from the design, so the same design gives the same picture. The
 * drawings the platform has are the front and the back; anything else says so.
 */
export function imageOutputs(input: PanelInput, options: ImageOptions): readonly ExportOutput[] {
  if (options.type !== "svg") return [notYet(`image-${options.type}`, `${options.view} as ${options.type.toUpperCase()}`, NO_RASTER)];
  const views = drawnViews(input, options.view);
  if (views.length === 0) return [notYet(`image-${options.view}`, `${options.view} view`, NO_SIDE_VIEW)];
  const extras = options.withMannequin || options.withBackground ? [notYet("image-dressed", "With a mannequin or a background", NO_MANNEQUIN)] : [];
  return [
    ...views.map((view) => ready(`svg-${view}`, `${VIEW_LABELS[view]} drawing (SVG)`, exportAddress(input, "svg", [`view=${view}`]))),
    ...extras,
  ];
}

const NO_DXF_HERE = "The DXF is kept with the pattern. Ask for a pattern on the Pattern page, then download it there.";
const NO_PATTERN_PNG = "A picture of the pattern is not made yet. The full-size PDF and the SVG are to scale.";
const NO_MEASUREMENTS_ON_PIECES = "Measurements drawn on the pieces are not made yet. The measurement table is in the tech pack.";

/** The pattern pieces, at full size. Each format is the one the print files route can make, or a plain sentence. */
export function patternOutputs(input: PanelInput, options: PatternOptions): readonly ExportOutput[] {
  const measurements = options.withMeasurements ? [notYet("pattern-measurements", "With measurements", NO_MEASUREMENTS_ON_PIECES)] : [];
  if (options.format === "dxf-aama") return [notYet("pattern-dxf", "DXF-AAMA", NO_DXF_HERE), ...measurements];
  if (options.format === "png") return [notYet("pattern-png", "PNG", NO_PATTERN_PNG), ...measurements];
  const format = options.format === "pdf-1-1" ? "pdf" : "svg";
  const label = options.format === "pdf-1-1" ? "Pieces at full size (PDF)" : "Pieces (SVG)";
  return [ready(`pattern-${format}`, label, printAddress(input, [format], input.size)), ...measurements];
}

/** The print files: one file for every piece, for the size on the canvas or for every size. */
export const printOutputs = (input: PanelInput, everySize: boolean): readonly ExportOutput[] => [
  ready(
    "print-files",
    everySize ? "Print files, every size" : `Print files, size ${input.size}`,
    printAddress(input, ["pdf", "svg"], everySize ? null : input.size),
  ),
];

const NO_PACKAGE_DOWNLOAD =
  "The production package is built for the factory when the order is placed. There is no download for it here yet.";

/** The production package (X5, `lib/kpp`). It is assembled for an order, and has no download of its own yet. */
export const packageOutputs = (): readonly ExportOutput[] => [notYet("kpp", "Production package (zip)", NO_PACKAGE_DOWNLOAD)];

const MOCKUPS_ELSEWHERE = "Mockups are made in the marketing media screen until the launch studio lands.";

/** Mockups and media: a way through to the screen that makes them, not a file. */
export const mockupOutputs = (input: PanelInput): readonly ExportOutput[] => [
  { id: "mockups", label: "Open the marketing media screen", address: mockupsAddress(input), notYet: null },
  notYet("mockups-here", "Mockups in this panel", MOCKUPS_ELSEWHERE),
];

export interface PanelOptions {
  readonly images: ImageOptions;
  readonly pattern: PatternOptions;
  readonly everySize: boolean;
}

/** What one tab would produce, from the choices made on it. */
export function outputsFor(tab: ExportPanelTabId, input: PanelInput, options: PanelOptions): readonly ExportOutput[] {
  switch (tab) {
    case "tech-pack":
      return techPackOutputs(input);
    case "images":
      return imageOutputs(input, options.images);
    case "pattern":
      return patternOutputs(input, options.pattern);
    case "print-files":
      return printOutputs(input, options.everySize);
    case "production-package":
      return packageOutputs();
    case "mockups":
      return mockupOutputs(input);
  }
}

/** The pattern page, for the sentence that points there. */
export const patternPageAddress = patternPage;
