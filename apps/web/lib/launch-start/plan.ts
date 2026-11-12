import type { ArtboardPreset, BoardKind } from "@/lib/launch";
import { presetSize } from "@/lib/launch";
import { defaultSettings, settingsToStored } from "@/lib/mockups/board";
import type { MockupScene } from "@/lib/mockups/types";
import type { MarketingFormat } from "@/lib/marketing/templates/types";

/**
 * STARTING A LAUNCH CANVAS FROM A DASHBOARD PAGE (decision 0140).
 *
 * The Templates, Mockups and Marketing pages each open a launch canvas with one thing already on
 * it: a mockup board, a marketing board, or a whole flow pack. This file decides which boards that
 * is, where they sit and what they hold; `actions.ts` saves them through L1's own functions
 * (`save_launch_board`, `connect_launch_boards`), so a dashboard page can wire nothing a person
 * could not wire by hand on the canvas.
 *
 * **The garment stays locked** (spec decision 13). The new board is connected from a Design board
 * holding the brand's own design, so the picture it makes is of the garment the platform drew.
 */

export const LAUNCH_SOURCES = ["flow", "marketing", "mockup", "ad"] as const;
export type LaunchSource = (typeof LAUNCH_SOURCES)[number];

export interface StartDesign {
  readonly id: string;
  readonly name: string;
  readonly version: number;
}

export interface PlannedBoard {
  readonly kind: BoardKind;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly settings: Readonly<Record<string, unknown>>;
  readonly inputVersion: number | null;
}

/** The side of a board when nothing gives it one: the launch shell's own default artboard. */
export const DEFAULT_SIDE = 1080;
/** The space between the Design board and the board it feeds. */
export const GAP = 200;

export const designBoard = (design: StartDesign): PlannedBoard => ({
  kind: "design",
  name: design.name,
  x: 0,
  y: 0,
  width: DEFAULT_SIDE,
  height: DEFAULT_SIDE,
  settings: { designProjectId: design.id },
  inputVersion: design.version,
});

const beside = { x: DEFAULT_SIDE + GAP, y: 0 } as const;

/** A mockup board on one scene, showing one colourway of the design or its first. */
export function mockupBoard(scene: MockupScene, colourwayId: string | null): PlannedBoard {
  return {
    kind: "mockup",
    name: scene.title,
    ...beside,
    width: DEFAULT_SIDE,
    height: DEFAULT_SIDE,
    settings: settingsToStored({ ...defaultSettings(scene), colourwayId }),
    inputVersion: null,
  };
}

export interface MarketingPick {
  readonly slug: string;
  readonly title: string;
  readonly layoutKey: string;
  readonly format: MarketingFormat;
}

/** The size of a format, from the platform's own artboard rows, or the default square. */
export function formatSize(format: MarketingFormat | null, presets: readonly ArtboardPreset[]): Readonly<{ width: number; height: number }> {
  const preset = format === null ? undefined : presets.find((one) => one.key === format);
  return preset === undefined ? { width: DEFAULT_SIDE, height: DEFAULT_SIDE } : presetSize(preset);
}

/**
 * A marketing board on one layout, or an empty one for "Create an ad", whose panel offers the
 * campaign form ("Start from a campaign instead").
 */
export function marketingBoard(pick: MarketingPick | null, presets: readonly ArtboardPreset[]): PlannedBoard {
  const size = formatSize(pick?.format ?? null, presets);
  return {
    kind: "marketing",
    name: pick?.title ?? "New ad",
    ...beside,
    ...size,
    settings: pick === null ? {} : { templateSlug: pick.slug, layoutKey: pick.layoutKey, format: pick.format },
    inputVersion: null,
  };
}

/** The canvas to open, with the new board selected, and the rail panel that edits it. */
export function landingPath(launchProjectId: string, boardId: string | null, panel: "mockups" | null): string {
  const query = new URLSearchParams();
  if (panel !== null) query.set("panel", panel);
  if (boardId !== null) query.set("board", boardId);
  const text = query.toString();
  return `/launch/${encodeURIComponent(launchProjectId)}${text ? `?${text}` : ""}`;
}

/** The launch project's name: the thing it was started from. */
export const launchName = (title: string): string => title.trim().slice(0, 80) || "New launch";
