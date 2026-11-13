import { newBoardSize, type Point, type Size } from "@/lib/canvas";
import { MAX_ARTBOARD_PX, MIN_ARTBOARD_PX, toPixels, type ArtboardPreset, type ArtboardUnit } from "@/lib/launch";

/**
 * CHOOSE ARTBOARD SIZE (plan v6 E5, decision 0149; `08` v3.2 "Choose Artboard Size modal", v3.7
 * "Print on demand", prototype e02).
 *
 * The sizes are the platform's own preset rows (`launch_artboard_presets`, decision 0091), never a
 * literal here. The rows carry no group yet, so the Social, Marketing and Store tabs read a small
 * map from the seeded keys (`PRESET_GROUPS`); a preset an admin adds later shows under Popular until
 * it is given a group (owner question 2 of 0149). **Products** lists the brand's designs: picking one
 * adds a garment board at E1's `newBoardSize("garment")`. Print on demand is a paid tab.
 */

export const ARTBOARD_TABS = ["popular", "products", "social", "marketing", "store", "pod"] as const;
export type ArtboardTab = (typeof ARTBOARD_TABS)[number];

export const ARTBOARD_TAB_LABELS: Readonly<Record<ArtboardTab, string>> = {
  popular: "Popular",
  products: "Products",
  social: "Social",
  marketing: "Marketing",
  store: "Store",
  pod: "Print on demand",
};

/** The paid tab: Kittl's crowned Print tab, ours the kit print areas at production size. */
export const PREMIUM_TABS: readonly ArtboardTab[] = ["pod"];

type Group = Extract<ArtboardTab, "social" | "marketing" | "store">;

/** The seeded presets' groups. A key not here is in Popular only. */
export const PRESET_GROUPS: Readonly<Record<string, Group>> = {
  "social-post-4-5": "social",
  "social-square-1-1": "social",
  "story-9-16": "social",
  "pin-2-3": "social",
  "hero-banner-16-9": "store",
  "a4-print": "marketing",
};

/** The presets a tab shows, in the rows' own order. */
export function presetsIn(tab: ArtboardTab, presets: readonly ArtboardPreset[]): readonly ArtboardPreset[] {
  if (tab === "popular") return presets;
  if (tab === "products" || tab === "pod") return [];
  return presets.filter((preset) => PRESET_GROUPS[preset.key] === tab);
}

/** "1080 × 1350 px" or "210 × 297 mm", as a card's second line. */
export const sizeLine = (width: number, height: number, unit: ArtboardUnit): string => `${trim(width)} × ${trim(height)} ${unit}`;

const trim = (value: number): string => (Number.isInteger(value) ? String(value) : value.toFixed(1).replace(/\.0$/, ""));

export interface CustomSize {
  readonly width: number;
  readonly height: number;
  readonly unit: ArtboardUnit;
  readonly dpi: number;
  readonly margin: boolean;
}

export const customOf = (preset: ArtboardPreset): CustomSize => ({ width: preset.width, height: preset.height, unit: preset.unit, dpi: preset.dpi, margin: false });

export const DEFAULT_CUSTOM: CustomSize = { width: 1080, height: 1080, unit: "px", dpi: 72, margin: false };

export type Orientation = "portrait" | "landscape";

export const orientationOf = (size: Pick<CustomSize, "width" | "height">): Orientation => (size.width > size.height ? "landscape" : "portrait");

/** Turns the size round when the other orientation is asked for; a square stays as it is. */
export function withOrientation(size: CustomSize, want: Orientation): CustomSize {
  if (size.width === size.height || orientationOf(size) === want) return size;
  return { ...size, width: size.height, height: size.width };
}

export type SizeVerdict = Readonly<{ ok: true; pixels: Size }> | Readonly<{ ok: false; reason: string }>;

/** The size in pixels, or why it cannot be made: the canvas's own bounds (`lib/launch/artboard.ts`). */
export function checkSize(size: CustomSize): SizeVerdict {
  if (!(size.width > 0) || !(size.height > 0)) return { ok: false, reason: "Give a width and a height above nought." };
  if (!(size.dpi > 0)) return { ok: false, reason: "Give a DPI above nought." };
  const pixels = { width: Math.round(toPixels(size.width, size.unit, size.dpi)), height: Math.round(toPixels(size.height, size.unit, size.dpi)) };
  const sides = [pixels.width, pixels.height];
  if (sides.some((side) => side < MIN_ARTBOARD_PX)) return { ok: false, reason: `An artboard is at least ${MIN_ARTBOARD_PX} px on each side.` };
  if (sides.some((side) => side > MAX_ARTBOARD_PX)) return { ok: false, reason: `An artboard is at most ${MAX_ARTBOARD_PX.toLocaleString("en-GB")} px on each side.` };
  return { ok: true, pixels };
}

/** The body `saveBoardAction` takes for a new artboard: its export size, its margin, its place. */
export function artboardBody(launchProjectId: string, size: CustomSize, pixels: Size, at: Point) {
  return {
    launchProjectId,
    boardId: null,
    kind: "artboard" as const,
    name: "",
    x: at.x,
    y: at.y,
    width: pixels.width,
    height: pixels.height,
    settings: { unit: size.unit, dpi: size.dpi, margin: size.margin },
    inputVersion: null,
  };
}

/** The body for a garment board on one of the brand's designs, at E1's garment box. */
export function garmentBody(launchProjectId: string, design: Readonly<{ id: string; name: string; version: number }>, at: Point) {
  const box = newBoardSize("garment") as Size;
  return {
    launchProjectId,
    boardId: null,
    kind: "garment" as const,
    name: design.name.slice(0, 80),
    x: at.x,
    y: at.y,
    width: box.width,
    height: box.height,
    settings: { designProjectId: design.id },
    inputVersion: design.version,
  };
}

/** Where a new board goes: right of everything on the canvas, level with the top board. */
export function placeForNew(boxes: readonly Readonly<{ x: number; y: number; width: number; height: number }>[]): Point {
  if (boxes.length === 0) return { x: 0, y: 0 };
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  const top = Math.min(...boxes.map((box) => box.y));
  return { x: right + 112, y: top };
}
