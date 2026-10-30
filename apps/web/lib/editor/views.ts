import { CANVAS_VIEWS, type CanvasView } from "./slots";

/**
 * The canvas: 2D, 3D and Tech pack, toggled at the bottom centre, on their own or side by side
 * (spec F-S4). All three are views of the same design version, so switching never loses state:
 * the view is held in the address and nothing else changes with it.
 */

interface ViewInfo {
  readonly id: CanvasView;
  readonly label: string;
  /** What a screen reader hears for the region that holds the view. */
  readonly region: string;
}

export const DEFAULT_VIEW: CanvasView = "2d";

export const VIEWS: Readonly<Record<CanvasView, ViewInfo>> = {
  "2d": { id: "2d", label: "2D", region: "2D pattern view" },
  "3d": { id: "3d", label: "3D", region: "3D view" },
  "tech-pack": { id: "tech-pack", label: "Tech pack", region: "Tech pack view" },
};

const isView = (value: string): value is CanvasView => (CANVAS_VIEWS as readonly string[]).includes(value);

/** The view the address names, or `fallback`. A name given twice counts once. */
export function parseView(value: string | readonly string[] | null | undefined, fallback: CanvasView = DEFAULT_VIEW): CanvasView {
  const first = typeof value === "string" ? value : value?.[0];
  return first && isView(first) ? first : fallback;
}

/** The second view of a side-by-side canvas, or null when one view is shown on its own. */
export function parseBeside(value: string | readonly string[] | null | undefined, main: CanvasView): CanvasView | null {
  const first = typeof value === "string" ? value : value?.[0];
  if (!first || !isView(first) || first === main) return null;
  return first;
}

/**
 * The views on the canvas, left to right, in the toggle's own order so the pair does not jump
 * about when the second one is chosen. One view on its own, or two side by side.
 */
export function viewsShown(main: CanvasView, beside: CanvasView | null): readonly CanvasView[] {
  if (!beside || beside === main) return [main];
  return CANVAS_VIEWS.filter((view) => view === main || view === beside);
}

/**
 * Which views a click on the toggle leaves showing: the one asked for, alone, or added beside the
 * one already there. The field names are the shell state's own (`view`, `beside`), so the result
 * can be spread over it without a rename losing the change.
 */
export function toggled(view: CanvasView, beside: CanvasView | null, asked: CanvasView, alongside: boolean): { view: CanvasView; beside: CanvasView | null } {
  if (!alongside) return { view: asked, beside: null };
  if (asked === view) return { view: beside ?? asked, beside: null };
  if (asked === beside) return { view, beside: null };
  return { view, beside: asked };
}

/** Whether a view is on the canvas now, so the shell draws it and the toggle marks it. */
export const showing = (main: CanvasView, beside: CanvasView | null, view: CanvasView): boolean => view === main || view === beside;
