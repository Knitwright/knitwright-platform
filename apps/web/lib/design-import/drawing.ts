import type { ImportView } from "./view-model";

/**
 * Our drawing of the stack, in the picture's own proportions (0 to 1 each way) so it lines up with the picture on the
 * left. The garment's outline in the ground colour, and each mark where it was read. A drawing for looking at, not a print file.
 * Types only are imported, so the browser takes none of the server's code.
 */

export interface DrawnView {
  readonly view: string;
  /** SVG points, "x,y x,y ...". */
  readonly points: string;
  readonly fill: string;
}

export interface DrawnMark {
  readonly layerId: string;
  readonly kind: string;
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly text: string | null;
  readonly ink: string;
  /** A crest, sponsor or badge redrawn from the picture. */
  readonly redrawn: boolean;
}

export interface Drawing {
  readonly views: readonly DrawnView[];
  readonly marks: readonly DrawnMark[];
}

const NEUTRAL = "#d0d3da";
const INK = "#1d2330";
const SCREEN = /^#[0-9a-fA-F]{6}$/;

export function drawingOf(view: Pick<ImportView, "stack" | "overlay">): Drawing {
  const ground = view.stack.layers.find((layer) => layer.kind === "ground");
  const fill = ground?.kind === "ground" ? view.stack.colours.find((c) => c.id === ground.colourId)?.screen : undefined;
  const present = new Set(view.stack.layers.map((layer) => layer.id));
  return {
    views: view.overlay.views.map((entry) => ({
      view: entry.view,
      points: entry.outline.map((p) => `${p.x},${p.y}`).join(" "),
      fill: fill && SCREEN.test(fill) ? fill : NEUTRAL,
    })),
    marks: view.overlay.marks
      .filter((mark) => present.has(mark.layerId))
      .map((mark) => ({
        layerId: mark.layerId,
        kind: mark.kind,
        ...mark.box,
        text: mark.text,
        ink: mark.ink && SCREEN.test(mark.ink) ? mark.ink : INK,
        redrawn: mark.kind === "crest" || mark.kind === "sponsor" || mark.kind === "sleeve-badge",
      })),
  };
}
