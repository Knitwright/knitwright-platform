/**
 * The bottom of the launch shell (spec Launch shell, "Bottom centre"): the prompt pill, the tool
 * dock, undo and redo, the zoom and the credit balance. Plain data and functions, so the screen
 * holds markup and wiring only, as `lib/editor/rail.ts` does for the editor.
 */

/** The seven tools of the dock, in the spec's order. */
export const DOCK_TOOLS = ["select", "frame", "shape", "pen", "text", "comment", "ai"] as const;
export type DockTool = (typeof DOCK_TOOLS)[number];

export const DEFAULT_TOOL: DockTool = "select";

interface DockToolInfo {
  readonly id: DockTool;
  readonly label: string;
  /** What the tool does, for its title and for a screen reader. */
  readonly hint: string;
}

export const TOOLS: Readonly<Record<DockTool, DockToolInfo>> = {
  select: { id: "select", label: "Select", hint: "Pick a board or a picture to work on." },
  frame: { id: "frame", label: "Frame", hint: "Draw an artboard at a size you choose." },
  shape: { id: "shape", label: "Shape", hint: "Draw a rectangle, a circle or a line." },
  pen: { id: "pen", label: "Pen", hint: "Draw your own outline, point by point." },
  text: { id: "text", label: "Text", hint: "Add words in one of the brand's type styles." },
  comment: { id: "comment", label: "Comment", hint: "Leave a note for the other members of your brand." },
  ai: { id: "ai", label: "AI", hint: "Describe a scene around the garment the platform drew." },
};

/** The words in the prompt pill before anything is typed (spec: "Describe what you want to create"). */
export const PROMPT_PLACEHOLDER = "Describe what you want to create";

const isTool = (value: string): value is DockTool => (DOCK_TOOLS as readonly string[]).includes(value);

/** The tool an address names, or Select. */
export const dockTool = (value: string | readonly string[] | null | undefined): DockTool => {
  const first = typeof value === "string" ? value : value?.[0];
  return first && isTool(first) ? first : DEFAULT_TOOL;
};

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

/** The tool a key moves to, as a tab list does: arrows step and wrap, Home and End jump to the ends. */
export function toolKeyTarget(current: DockTool, key: string): DockTool | null {
  const last = DOCK_TOOLS.length - 1;
  const at = DOCK_TOOLS.indexOf(current);
  if (key === "Home") return DOCK_TOOLS[0];
  if (key === "End") return DOCK_TOOLS[last];
  if (NEXT_KEYS.has(key)) return DOCK_TOOLS[at === last ? 0 : at + 1];
  if (PREVIOUS_KEYS.has(key)) return DOCK_TOOLS[at <= 0 ? last : at - 1];
  return null;
}

/** The zoom steps the per-cent control moves between, as Kittl's does. */
export const ZOOM_STEPS: readonly number[] = [10, 25, 50, 75, 100, 150, 200, 400];
export const DEFAULT_ZOOM = 100;
export const MIN_ZOOM = ZOOM_STEPS[0] as number;
export const MAX_ZOOM = ZOOM_STEPS[ZOOM_STEPS.length - 1] as number;

/** A zoom per-cent held inside the range. A value that is not a number means the default. */
export function clampZoom(percent: number): number {
  if (!Number.isFinite(percent)) return DEFAULT_ZOOM;
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, Math.round(percent)));
}

/** The next step up, or the largest. */
export const zoomIn = (percent: number): number => ZOOM_STEPS.find((step) => step > percent) ?? MAX_ZOOM;

/** The next step down, or the smallest. */
export const zoomOut = (percent: number): number => [...ZOOM_STEPS].reverse().find((step) => step < percent) ?? MIN_ZOOM;

/**
 * The zoom that fits a canvas of this size into the space on screen, never above 100 per cent: a
 * board is never blown up just because the window is wide.
 */
export function fitZoom(content: Readonly<{ width: number; height: number }>, viewport: Readonly<{ width: number; height: number }>): number {
  if (content.width <= 0 || content.height <= 0) return DEFAULT_ZOOM;
  const scale = Math.min(viewport.width / content.width, viewport.height / content.height);
  return clampZoom(Math.min(1, scale) * 100);
}
