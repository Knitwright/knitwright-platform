/**
 * THE INFINITE PLANE (plan v6 E1, decision 0145; `08` §5.1 "Canvas", `10` "Canvas (editor)").
 *
 * A board lives at a place in *world* units. The screen shows the world through a viewport: a
 * translation in screen pixels and a scale, so `screen = world × scale + (x, y)`. Everything a pan,
 * a zoom, a fit or a culling pass needs is here, pure, so the hard part of the canvas is tested
 * without a browser.
 */

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

export interface Rect extends Point, Size {}

export interface Viewport {
  /** Where the world's origin sits on the screen, in screen pixels. */
  readonly x: number;
  readonly y: number;
  /** Screen pixels per world unit: 1 is 100%. */
  readonly scale: number;
}

/** 10% to 400% (`10` "Canvas (editor)"). */
export const MIN_SCALE = 0.1;
export const MAX_SCALE = 4;

export const HOME: Viewport = { x: 0, y: 0, scale: 1 };

/** The figures + and − step through, as Kittl's zoom menu has them. */
export const ZOOM_STEPS: readonly number[] = [0.1, 0.25, 0.33, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4];

export const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale));

/** `|| 0` so a point on the origin is 0 and never -0. */
export const screenToWorld = (view: Viewport, at: Point): Point => ({ x: (at.x - view.x) / view.scale || 0, y: (at.y - view.y) / view.scale || 0 });

export const worldToScreen = (view: Viewport, at: Point): Point => ({ x: at.x * view.scale + view.x, y: at.y * view.scale + view.y });

/** The view at a new scale, with the world point under `pointer` still under it. */
export function zoomAt(view: Viewport, pointer: Point, scale: number): Viewport {
  const next = clampScale(scale);
  const world = screenToWorld(view, pointer);
  return { x: pointer.x - world.x * next, y: pointer.y - world.y * next, scale: next };
}

/** One step of + (1) or − (−1) through `ZOOM_STEPS`, about a point. */
export function stepZoom(view: Viewport, direction: 1 | -1, pointer: Point): Viewport {
  const near = 1e-6;
  const target =
    direction === 1
      ? (ZOOM_STEPS.find((step) => step > view.scale + near) ?? MAX_SCALE)
      : ([...ZOOM_STEPS].reverse().find((step) => step < view.scale - near) ?? MIN_SCALE);
  return zoomAt(view, pointer, target);
}

/** How far one notch of a wheel or a pinch zooms. A trackpad sends many small deltas. */
const WHEEL_RATE = 0.0015;

/** Ctrl/⌘-wheel and pinch: a smooth zoom about the pointer. A negative delta zooms in. */
export const wheelZoom = (view: Viewport, deltaY: number, pointer: Point): Viewport =>
  deltaY === 0 ? view : zoomAt(view, pointer, view.scale * Math.exp(-deltaY * WHEEL_RATE));

export const panBy = (view: Viewport, by: Point): Viewport => ({ x: view.x + by.x, y: view.y + by.y, scale: view.scale });

export const zoomPercent = (view: Viewport): number => Math.round(view.scale * 100);

/** The box around every box, or null when there are none. */
export function boundsOf(rects: readonly Rect[]): Rect | null {
  if (rects.length === 0) return null;
  const left = Math.min(...rects.map((one) => one.x));
  const top = Math.min(...rects.map((one) => one.y));
  const right = Math.max(...rects.map((one) => one.x + one.width));
  const bottom = Math.max(...rects.map((one) => one.y + one.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
}

/**
 * Fit to content: the view that shows `bounds` whole and centred, with `padding` screen pixels
 * around it. It never zooms past 100%, so one small board does not fill the screen.
 */
export function fitTo(bounds: Rect | null, screen: Size, padding: number): Viewport {
  if (bounds === null || bounds.width <= 0 || bounds.height <= 0) return HOME;
  const room = { width: Math.max(1, screen.width - padding * 2), height: Math.max(1, screen.height - padding * 2) };
  const scale = clampScale(Math.min(1, room.width / bounds.width, room.height / bounds.height));
  const centre = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  return { x: screen.width / 2 - centre.x * scale, y: screen.height / 2 - centre.y * scale, scale };
}

/** The rectangle two corners make, whichever way the drag went (the marquee). */
export const rectFromPoints = (a: Point, b: Point): Rect => ({
  x: Math.min(a.x, b.x),
  y: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

/** Whether two rectangles share any area. Touching edges do not. */
export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** The world rectangle the screen shows, grown by `margin` screen pixels on every side. */
export function visibleRect(view: Viewport, screen: Size, margin: number): Rect {
  const topLeft = screenToWorld(view, { x: -margin, y: -margin });
  return { x: topLeft.x, y: topLeft.y, width: (screen.width + margin * 2) / view.scale, height: (screen.height + margin * 2) / view.scale };
}
