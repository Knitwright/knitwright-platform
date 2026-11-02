import type { ArtboardUnit } from "./artboard";
import type { LaunchAsset } from "./assets";
import type { BoardKind } from "./boards";
import type { DockTool } from "./dock";
import type { ArtboardPreset, BoardView, LaunchProjectView, Point, ProjectColour, Size } from "./types";

/**
 * THE BOARD PANEL CONTRACT (plan v5 wave 4, L1, decision 0091).
 *
 * The launch shell owns the chrome: the icon rail, the right inspector, the bottom prompt pill and
 * tool dock, undo and redo, the zoom, the credit balance, the main menu and the canvas. The panels
 * inside the rail, and the inspector of each board kind, are built by L2 to L6, and each one is
 * given exactly `LaunchPanelProps`: the project as read-only facts, the board that is selected, and
 * the commands it may ask the shell to carry out. Nothing else crosses the seam.
 *
 * It follows `lib/editor/slots.ts` (Y2, decision 0075) deliberately, including its one principle:
 *
 *   **A PANEL CANNOT PRODUCE AN INVALID RESULT.**
 *
 * Every entry of `LaunchCommands` is a request, never a write. The shell checks it, saves it, shows
 * the status and redraws. Three kinds of invalid result are therefore impossible rather than
 * discouraged:
 *
 *   * a connector the spec's board table does not allow -- `connect` goes through `canConnect`;
 *   * a paid run with no locked garment behind it -- `requestRun` goes through `runnable`, which
 *     refuses a board no Design board feeds (spec decision 13);
 *   * a generated picture used as artwork -- `offerAsset` takes a `LaunchAsset`, and a generated
 *     asset has no role but `"scene"`, so it cannot even be written down as a panel layer or a
 *     print file (`lib/launch/assets.ts`).
 *
 * A panel component is a default export taking `LaunchPanelProps`, so the shell can load it with
 * `next/dynamic`. Until a panel is built the shell draws `panelPlaceholder(id)` in its place.
 *
 * L2 to L6 code against this file. It does not change without a loud note on the pull request,
 * because five workstreams depend on it.
 *
 * THREE THINGS FROM THE TEMPLATE LIBRARY (L8, decision 0098) that reach panels through here:
 *   * `templates.kind` already exists, with the seven values of `07`. Do not add it again.
 *   * `lib/templates/service.ts` parses every row of `templates` against the design shape, so a
 *     workstream seeding `mockup_scene`, `marketing`, `video` or `flow` rows must first narrow
 *     `loadLibrary` to `kind = 'design'` in the same change, or the design library page breaks.
 *   * `authenticated` holds SELECT on `templates` column by column, so a migration that adds a
 *     column grants it in that same migration, or every read of the table is refused.
 */

/** Every panel the shell leaves for another workstream to fill. */
export const LAUNCH_PANELS = [
  // The icon rail, in the order the spec lists it (Launch shell, 02-features.md).
  "templates",
  "text",
  "elements",
  "ai-image",
  "mockups",
  "photos",
  "pattern-fills",
  "likes",
  "uploads",
  "brand",
  "assistant",
  "layers",
  // The right inspector of a selected board, one per kind the shell does not draw itself.
  "board-mockup",
  "board-ai-image",
  "board-ai-video",
  "board-marketing",
  "board-info-card",
  // The run summary of a flow: every output, its status and its cost (spec F-L4).
  "flow-run",
] as const;

export type LaunchPanelId = (typeof LAUNCH_PANELS)[number];

/** The inspector panel a selected board opens, or null for a board the shell draws itself. */
export const PANEL_OF_KIND: Readonly<Record<BoardKind, LaunchPanelId | null>> = {
  design: null,
  artboard: null,
  mockup: "board-mockup",
  ai_image: "board-ai-image",
  ai_video: "board-ai-video",
  marketing: "board-marketing",
  info_card: "board-info-card",
};

/** What the person has selected, which decides the inspector and the contextual task bar. */
export interface BoardSelection {
  readonly board: BoardView;
  /** True when the selection is the board's finished picture rather than the board itself. */
  readonly image: boolean;
}

/** What a panel may read. Everything here is already saved or already in flight; a panel never fetches. */
export interface LaunchContext {
  readonly project: LaunchProjectView;
  readonly selection: BoardSelection | null;
  /** The brand's credit balance, so a panel can show a cost against it before anything is spent. */
  readonly credits: number | null;
  /** The artboard sizes a platform admin keeps as rows. A panel never writes a size of its own. */
  readonly presets: readonly ArtboardPreset[];
  readonly unit: ArtboardUnit;
  readonly zoom: number;
  readonly dockTool: DockTool;
  /** True while a save or a run is in flight: a panel disables its own controls rather than queueing. */
  readonly busy: boolean;
}

/**
 * What a panel may ask the shell to do. Every call is a request. The shell checks it against the
 * board table, the garment lock and the project's own limits, saves it, shows the status and
 * redraws, so a panel cannot put the project into a state it could not have reached by hand.
 */
export interface LaunchCommands {
  /** Add a board of this kind at this place, optionally fed by the board the person came from. */
  addBoard(kind: BoardKind, at: Point, fromBoardId?: string): void;
  /** Draw a connector. Refused for a pair the board table does not allow, a taken input or a loop. */
  connect(fromBoardId: string, toBoardId: string, inputIndex: number): void;
  disconnect(edgeId: string): void;
  selectBoard(boardId: string | null, image?: boolean): void;
  moveBoard(boardId: string, at: Point): void;
  /** Set a board's size in pixels. Refused outside the project's own smallest and largest size. */
  resizeBoard(boardId: string, size: Size): void;
  /** Save this board's own prompt, model, aspect and style, so Regenerate reruns it unchanged. */
  setBoardSettings(boardId: string, settings: Readonly<Record<string, unknown>>): void;
  removeBoard(boardId: string): void;
  /**
   * Ask for a board to be run. The shell checks the garment lock first and shows the credit cost
   * before anything is spent, so a panel never meters or charges on its own.
   */
  requestRun(boardId: string): void;
  /** Run every board this one feeds, in order (spec F-L4 "Run all downstream"). */
  requestRunDownstream(boardId: string): void;
  /**
   * Hand the shell a finished picture for a board. A generated picture can only be a `SceneAsset`,
   * so this call cannot be used to put one on a panel of the garment or into a print file.
   */
  offerAsset(boardId: string, asset: LaunchAsset): void;
  setProjectColours(colours: readonly ProjectColour[]): void;
  /** Pixels, inches or millimetres, from the Settings item of the main menu. */
  setUnit(unit: ArtboardUnit): void;
  openPanel(id: LaunchPanelId): void;
  chooseTool(tool: DockTool): void;
  setZoom(percent: number): void;
  undo(): void;
  redo(): void;
}

/** Everything a panel component is given. A panel takes no other props. */
export interface LaunchPanelProps {
  readonly context: LaunchContext;
  readonly commands: LaunchCommands;
}

/** What the shell draws where a panel is not built yet: its name, who is building it, and a test id. */
export interface PanelPlaceholderInfo {
  readonly id: LaunchPanelId;
  readonly title: string;
  readonly note: string;
  readonly testId: string;
}

const PLACEHOLDERS: Readonly<Record<LaunchPanelId, Readonly<{ title: string; note: string }>>> = {
  templates: { title: "Templates", note: "Marketing, kit-bundle and flow templates for sportswear. Built by workstream L8; this panel is the slot it drops into." },
  text: { title: "Text", note: "Headline, subheadline and body text in the brand's own styles. Built by workstream L4." },
  elements: { title: "Elements", note: "Sport graphics, shapes and badges to place on an artboard. Built by workstream L4." },
  "ai-image": { title: "AI image", note: "Shoot ideas, the custom shoot panel and the model, pose and camera presets. Built by workstream L3." },
  mockups: { title: "Mockups", note: "The mockup library: collections, search and filters, with the deterministic scenes free. Built by workstream L2." },
  photos: { title: "Photos", note: "Your own photographs and the golden-sample photos of this design. Built by workstream L2." },
  "pattern-fills": { title: "Pattern fills", note: "Repeat prints from your library, as fills for shapes and backgrounds. Built by workstream L4." },
  likes: {
    title: "Likes",
    note: "The templates, scenes and graphics you have liked. Nothing in the platform records a like yet -- workstream L8 built the library without one, and the spec's own data model has a count on a template row rather than a record of who liked what -- so there is nothing here to list. Owner question of decision 0108.",
  },
  uploads: { title: "Uploads", note: "Files you have uploaded to this brand, with the rights you hold on each. Built by workstream L7." },
  brand: { title: "Brand", note: "Your logos, palettes, type styles and voice, applied in one click. Built by workstream L7." },
  assistant: { title: "AI assistant", note: "Write for me, in the brand's voice and tone. Built by workstream L4." },
  layers: { title: "Layers", note: "What is on the selected artboard, in order, with opacity and locking. Built by workstream L4." },
  "board-mockup": { title: "Mockup board", note: "The scene, the colourway and roster switcher, and Convert to image. Built by workstream L2." },
  "board-ai-image": { title: "AI image board", note: "The prompt, the style, the aspect, the count and the credit cost on the button. Built by workstream L3." },
  "board-ai-video": { title: "AI video board", note: "First and end frame, prompt presets, the model picker and the duration. Built by workstream L5." },
  "board-marketing": { title: "Marketing board", note: "The template's slots, Replace, Write for me and the export panel. Built by workstream L4." },
  "board-info-card": { title: "Info card", note: "The size chart, colour chart, fabric callouts and care card. Built by workstream L6." },
  "flow-run": { title: "Run summary", note: "Every output of this flow, its status and its cost, with Export all. Built by workstream L6." },
};

/** The labelled placeholder for a panel. Says plainly that it is not built yet, and never pretends to be it. */
export function panelPlaceholder(id: LaunchPanelId): PanelPlaceholderInfo {
  const entry = PLACEHOLDERS[id];
  return { id, title: entry.title, note: entry.note, testId: `launch-panel-${id}` };
}

/**
 * A test double of the whole contract: a panel's test renders against this instead of the shell,
 * and `calls` says what the panel asked for. The shell's own checks are not in here, because a
 * panel must never depend on them being skipped.
 */
export interface PanelDouble {
  readonly commands: LaunchCommands;
  readonly calls: { readonly name: string; readonly args: readonly unknown[] }[];
}

const COMMAND_NAMES: readonly (keyof LaunchCommands)[] = [
  "addBoard",
  "connect",
  "disconnect",
  "selectBoard",
  "moveBoard",
  "resizeBoard",
  "setBoardSettings",
  "removeBoard",
  "requestRun",
  "requestRunDownstream",
  "offerAsset",
  "setProjectColours",
  "setUnit",
  "openPanel",
  "chooseTool",
  "setZoom",
  "undo",
  "redo",
];

export function panelDouble(): PanelDouble {
  const calls: { name: string; args: readonly unknown[] }[] = [];
  const commands = Object.fromEntries(
    COMMAND_NAMES.map((name) => [name, (...args: readonly unknown[]) => calls.push({ name, args })]),
  ) as unknown as LaunchCommands;
  return { commands, calls };
}
