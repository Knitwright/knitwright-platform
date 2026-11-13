import { fitTo, HOME, panBy, rectFromPoints, stepZoom, visibleRect, wheelZoom, zoomAt, type Point, type Rect, type Size, type Viewport } from "./viewport";

/**
 * THE CANVAS STORE (decision 0145): the one place the canvas's view and selection live, for the
 * canvas itself and for everything later workstreams put around it -- E2's chrome and zoom menu,
 * E3's inspectors, E4's tech pack and order boards, E5's prompt bar.
 *
 * It is a plain subscribable object with no React in it, so it is tested here and read in a
 * component through `useCanvas(selector)` (`components/canvas/CanvasStore.tsx`), which is
 * `useSyncExternalStore` under the hood. Every change goes through a named command; state is
 * replaced, never mutated, so a selector that returns a part of it is stable until that part changes.
 *
 * The launch shell's own selection (one board, in the address as `?board=`) follows the store's
 * *primary* selection -- the first id -- so the inspector, the task bar and every L-workstream panel
 * keep working on the board a person last chose.
 */

export interface CanvasState {
  readonly viewport: Viewport;
  /** The selected boards, the primary one first. Empty when nothing is selected. */
  readonly selection: readonly string[];
  /** The board open in focused mode (a garment in the editor), or null on the plain canvas. */
  readonly focus: string | null;
  /** The marquee being dragged, in world units, or null. */
  readonly marquee: Readonly<{ from: Point; to: Point }> | null;
  /** The size of the canvas on screen, in screen pixels, kept by the canvas as it resizes. */
  readonly screen: Size;
  /** The element (a layer on a garment board) the inspector shows, or null for the board itself (E3, decision 0147). */
  readonly element: CanvasElement | null;
  /** The mockup board in mockup edit mode (double-click), or null (E3, decision 0147). */
  readonly editing: string | null;
}

/** One layer of one board, as the inspector selects it. */
export interface CanvasElement {
  readonly boardId: string;
  readonly id: string;
}

export const INITIAL_STATE: CanvasState = { viewport: HOME, selection: [], focus: null, marquee: null, screen: { width: 0, height: 0 }, element: null, editing: null };

export type Listener = () => void;

export interface CanvasStore {
  getState(): CanvasState;
  subscribe(listener: Listener): () => void;
  /** Select one board, or none. A plain click. */
  select(id: string | null): void;
  /** Add a board to the selection, or take it out. A Shift-click. */
  toggle(id: string): void;
  /** Select exactly these boards, the first as primary. */
  selectMany(ids: readonly string[]): void;
  setViewport(viewport: Viewport): void;
  panBy(by: Point): void;
  /** Zoom to a scale about a screen point, or about the middle of the screen. */
  zoomTo(scale: number, about?: Point): void;
  /** One step of + or −, about a screen point or the middle of the screen. */
  zoomStep(direction: 1 | -1, about?: Point): void;
  /** Ctrl/⌘-wheel or pinch, about the pointer. */
  zoomWheel(deltaY: number, about: Point): void;
  /** Fit these world bounds into the screen, with `padding` screen pixels round them. */
  fit(bounds: Rect | null, padding?: number): void;
  /** Bring a world rectangle onto the screen, at the zoom there is, if it is not on it already. */
  reveal(box: Rect): void;
  setScreen(screen: Size): void;
  beginMarquee(at: Point): void;
  moveMarquee(at: Point): void;
  /** Finish the marquee with the ids it caught; `additive` (Shift held) keeps what was selected. */
  endMarquee(caught: readonly string[], additive: boolean): void;
  setFocus(id: string | null): void;
  /** Show one layer of a board in the inspector, or the board again with null (E3). */
  selectElement(element: CanvasElement | null): void;
  /** Open a mockup board in mockup edit mode, or finish with null (E3). */
  setEditing(id: string | null): void;
}

/** The selection with one id taken out or put in at the end, the primary staying first. */
export const toggled = (selection: readonly string[], id: string): readonly string[] =>
  selection.includes(id) ? selection.filter((one) => one !== id) : [...selection, id];

/** The ids of `caught` added to `selection` without repeats, in order. */
export const merged = (selection: readonly string[], caught: readonly string[]): readonly string[] => [
  ...selection,
  ...caught.filter((id) => !selection.includes(id)),
];

/** The marquee's rectangle, in world units, or null. */
export const marqueeRect = (state: CanvasState): Rect | null => (state.marquee === null ? null : rectFromPoints(state.marquee.from, state.marquee.to));

/** The primary selected board, or null. */
export const primaryOf = (state: CanvasState): string | null => state.selection[0] ?? null;

export const centreOf = (screen: Size): Point => ({ x: screen.width / 2, y: screen.height / 2 });

/** The view with `box` brought to the middle of the screen when any of it is off the screen. */
export function revealed(view: Viewport, screen: Size, box: Rect): Viewport {
  const shown = visibleRect(view, screen, 0);
  const inside = box.x >= shown.x && box.y >= shown.y && box.x + box.width <= shown.x + shown.width && box.y + box.height <= shown.y + shown.height;
  if (inside || screen.width === 0) return view;
  const centre = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  return { x: screen.width / 2 - centre.x * view.scale, y: screen.height / 2 - centre.y * view.scale, scale: view.scale };
}

const sameIds = (a: readonly string[], b: readonly string[]): boolean => a.length === b.length && a.every((id, at) => id === b[at]);

export function createCanvasStore(initial: Partial<CanvasState> = {}): CanvasStore {
  let state: CanvasState = { ...INITIAL_STATE, ...initial };
  const listeners = new Set<Listener>();

  const set = (next: CanvasState): void => {
    if (next === state) return;
    state = next;
    for (const listener of [...listeners]) listener();
  };
  const setSelection = (selection: readonly string[]): void => {
    if (!sameIds(selection, state.selection)) set({ ...state, selection });
  };
  const view = (viewport: Viewport): void => {
    const now = state.viewport;
    if (viewport.x !== now.x || viewport.y !== now.y || viewport.scale !== now.scale) set({ ...state, viewport });
  };

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    select: (id) => setSelection(id === null ? [] : [id]),
    toggle: (id) => setSelection(toggled(state.selection, id)),
    selectMany: (ids) => setSelection([...new Set(ids)]),
    setViewport: view,
    panBy: (by) => view(panBy(state.viewport, by)),
    zoomTo: (scale, about) => view(zoomAt(state.viewport, about ?? centreOf(state.screen), scale)),
    zoomStep: (direction, about) => view(stepZoom(state.viewport, direction, about ?? centreOf(state.screen))),
    zoomWheel: (deltaY, about) => view(wheelZoom(state.viewport, deltaY, about)),
    fit: (bounds, padding = 64) => view(fitTo(bounds, state.screen, padding)),
    reveal: (box) => view(revealed(state.viewport, state.screen, box)),
    setScreen: (screen) => {
      if (screen.width !== state.screen.width || screen.height !== state.screen.height) set({ ...state, screen });
    },
    beginMarquee: (at) => set({ ...state, marquee: { from: at, to: at } }),
    moveMarquee: (at) => {
      if (state.marquee !== null) set({ ...state, marquee: { from: state.marquee.from, to: at } });
    },
    endMarquee(caught, additive) {
      const selection = additive ? merged(state.selection, caught) : [...caught];
      set({ ...state, marquee: null, selection: sameIds(selection, state.selection) ? state.selection : selection });
    },
    setFocus: (id) => {
      if (id !== state.focus) set({ ...state, focus: id });
    },
    selectElement: (element) => {
      const now = state.element;
      if (element?.boardId !== now?.boardId || element?.id !== now?.id) set({ ...state, element });
    },
    setEditing: (id) => {
      if (id !== state.editing) set({ ...state, editing: id });
    },
  };
}
