/**
 * Artwork stacks for the tech pack tests: one stack for each layer kind, and one that holds them all. Each is a
 * valid W7a stack (a test parses them), so the tech pack is built from the same model the print files use.
 */
import { DEFAULT_DATUM, writeStack, type ArtworkStack, type GraphicLayer, type Layer, type StackColour } from "@/lib/artwork-stack";
import type { GarmentSpec } from "@/lib/garment";
import type { ImportReport } from "@/lib/design-import/report";
import type { LowDpiAcceptance, PictureRead, PlacedAsset } from "../production/input";
import { targetedJersey } from "./production";

const FLAT = ["front", "back"] as const;

const colour = (id: string, role: string, screen: string, codes: StackColour["codes"] = []): StackColour => ({
  id,
  role,
  screen,
  codes,
  provenance: "user-edited",
});

export const NAVY = colour("navy", "ground", "#1b2a49", [{ system: "factory", value: "NV-204", source: "user-edited" }]);
export const GOLD = colour("gold", "dots", "#d4af37", [{ system: "pantone-tcx", value: "13-0859 TCX", source: "user-edited" }]);
export const WHITE = colour("white", "numbers", "#ffffff");
export const GREEN = colour("green", "camo", "#3b5d2a", [{ system: "factory", value: "GR-7", source: "user-edited" }]);

const base = {
  views: [...FLAT],
  opacity: 1,
  blend: "normal" as const,
  provenance: "user-edited" as const,
};

const ground: Layer = { ...base, kind: "ground", id: "ground-body", name: "Body", colourId: "navy" };

const DOTS_LAYER: Layer = {
  ...base,
  kind: "pattern",
  id: "dots",
  name: "Polka dots",
  generatorId: "kit-dots",
  params: { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true, clearSpaceMm: 10 },
  datum: DEFAULT_DATUM,
  colourIds: ["gold", "white"],
};

const CAMO_LAYER: Layer = {
  ...base,
  kind: "pattern",
  id: "camo",
  name: "Camo",
  generatorId: "camo",
  params: { scale: 60, spread: 0.6, roughness: 0.3 },
  seed: 7,
  datum: DEFAULT_DATUM,
  colourIds: ["green", "gold", "white"],
};

const TILE_LAYER: Layer = {
  ...base,
  kind: "image-fill",
  id: "club-tile",
  name: "Club tile",
  assetId: "tile-1",
  mode: "tile",
  scale: 1,
  rotationDeg: 0,
  offsetMm: { x: 0, y: 0 },
  halfDrop: true,
  fit: "cover",
};

const PANEL_LAYER: Layer = {
  ...base,
  kind: "image-fill",
  id: "front-art",
  name: "Front panel art",
  views: ["front"],
  assetId: "panel-1",
  mode: "panel",
  scale: 1,
  rotationDeg: 0,
  offsetMm: { x: 0, y: 0 },
  halfDrop: false,
  fit: "cover",
};

export const CREST_LAYER: GraphicLayer = {
  ...base,
  kind: "graphic",
  id: "crest",
  name: "Club crest",
  views: ["front"],
  source: { kind: "asset", assetId: "crest-1" },
  placement: { kind: "zone", zoneId: "crest" },
  offsetMm: { x: 0, y: 0 },
  widthMm: 90,
  rotationDeg: 0,
  clearSpaceMm: 10,
  knockOut: true,
  technique: "sublimation",
};

const OLD_LOGO_LAYER: GraphicLayer = {
  ...base,
  kind: "graphic",
  id: "sleeve-logo",
  name: "Sleeve logo",
  views: ["front"],
  source: { kind: "file", fileId: "6f1c1d2e-3b4a-4c5d-8e9f-0a1b2c3d4e5f" },
  placement: { kind: "anchor", anchorId: "centre-chest" },
  offsetMm: { x: 5, y: 0 },
  widthMm: 60,
  heightMm: 30,
  rotationDeg: 0,
  clearSpaceMm: 0,
  knockOut: false,
};

const TEXT_LAYER: Layer = {
  ...base,
  kind: "text",
  id: "sponsor",
  name: "Sponsor line",
  views: ["front"],
  text: "ACME PLUMBING",
  lettering: "block",
  placement: { kind: "anchor", anchorId: "centre-chest" },
  offsetMm: { x: 0, y: 20 },
  heightMm: 30,
  rotationDeg: 0,
  colourId: "white",
};

const MARK_LAYER: Layer = {
  ...base,
  kind: "player-mark",
  id: "mark-back-name",
  views: ["back"],
  place: "back-name",
  style: "block",
  heightMm: 60,
  colourId: "white",
  sample: { name: "RIVERA", number: "9" },
};

const stack = (layers: readonly Layer[], colours: readonly StackColour[] = [NAVY, GOLD, WHITE, GREEN]): ArtworkStack => ({
  schemaVersion: 1,
  views: [...FLAT],
  colours,
  layers: [ground, ...layers],
  colourways: [
    { id: "home", name: "Home", colours: {} },
    { id: "away", name: "Away", colours: { navy: { screen: "#aa0000", codes: [], provenance: "user-edited" } } },
  ],
});

export const GROUND_STACK = stack([]);
export const DOTS_STACK = stack([DOTS_LAYER]);
export const CAMO_STACK = stack([CAMO_LAYER]);
export const TILE_STACK = stack([TILE_LAYER]);
export const PANEL_STACK = stack([PANEL_LAYER]);
export const GRAPHIC_STACK = stack([CREST_LAYER, OLD_LOGO_LAYER]);
export const TEXT_STACK = stack([TEXT_LAYER]);
export const MARK_STACK = stack([MARK_LAYER]);

/** One stack fixture per layer kind. */
export const STACK_BY_KIND = {
  ground: GROUND_STACK,
  pattern: DOTS_STACK,
  "image-fill": TILE_STACK,
  graphic: GRAPHIC_STACK,
  text: TEXT_STACK,
  "player-mark": MARK_STACK,
} as const;

/** Every kind in one design: dots under a tile, a crest, an old logo, a sponsor line and a name. */
export const ALL_KINDS_STACK = stack([DOTS_LAYER, TILE_LAYER, CREST_LAYER, OLD_LOGO_LAYER, TEXT_LAYER, MARK_LAYER]);
export const CAMO_CREST_STACK = stack([CAMO_LAYER, CREST_LAYER, MARK_LAYER]);

export const ASSETS: readonly PlacedAsset[] = [
  { id: "crest-1", label: "Club crest", kind: "raster", widthPx: 1200, heightPx: 1200, dpiMeta: 300 },
  { id: "tile-1", label: "Club tile", kind: "raster", widthPx: 600, heightPx: 600, dpiMeta: 150 },
  { id: "panel-1", label: "Front art", kind: "raster", widthPx: 6000, heightPx: 8000, dpiMeta: 300 },
  { id: "vector-1", label: "Vector crest", kind: "vector", widthPx: 800, heightPx: 800, dpiMeta: null },
];

/** A small crest that would print soft at 90 mm: 400 px over 90 mm is about 113 dpi. */
export const SMALL_CREST: PlacedAsset = { id: "crest-1", label: "Club crest", kind: "raster", widthPx: 400, heightPx: 400, dpiMeta: null };

/** The design with this stack stored and the older fields set from it, as the editor saves it. */
export const withStack = (stack: ArtworkStack, spec: GarmentSpec = targetedJersey()): GarmentSpec => writeStack(spec, stack, 1);

export const LOW_DPI_ACCEPTED: LowDpiAcceptance = { layerId: "crest", name: "Sam Lee", date: "11 Oct 2026", dateIso: "2026-10-11" };

/** A design read from a picture: a ground and a crest, both read, with one view left empty. */
export const PICTURE_STACK: ArtworkStack = {
  ...stack([{ ...CREST_LAYER, provenance: "read-from-image" }, { ...TEXT_LAYER, provenance: "read-from-image" }]),
  layers: [
    { ...ground, provenance: "read-from-image" },
    { ...CREST_LAYER, provenance: "read-from-image" },
    { ...TEXT_LAYER, provenance: "read-from-image" },
  ],
};

export const IMPORT_REPORT: ImportReport = {
  summary: "Read a navy jersey with a crest and a sponsor line from your picture.",
  pictureNote: "Mockup, flattened approximately",
  confidence: 0.62,
  items: [{ id: "crest", layerId: "crest", label: "Crest", confidence: 0.5, note: "Redrawn from a picture, replace with your own file" }],
  emptyViews: [{ view: "back", sentence: "The back is not in your picture, so its layers are left empty. Nothing was invented for it." }],
  notes: ["Colours are screen colours; no codes were guessed."],
  dpiWarnings: [],
  guessed: ["The size of the sponsor line"],
  fittedTo: "Fitted to the flat outline of the pattern",
  generatedPixels: false,
  spend: { visionCalls: 1, imageEdits: 0 },
};

export const PICTURE_ACCEPTED: PictureRead = {
  report: IMPORT_REPORT,
  acceptedLayerIds: ["ground-body", "crest", "sponsor"],
  acceptedBy: { name: "Mia Chen", date: "12 Oct 2026", dateIso: "2026-10-12" },
};

export const PICTURE_NOT_ACCEPTED: PictureRead = { report: IMPORT_REPORT, acceptedLayerIds: null, acceptedBy: null };
