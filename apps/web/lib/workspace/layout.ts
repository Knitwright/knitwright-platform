/**
 * What the workspace shows besides the open tool: whether the assistant is docked or collapsed on
 * a wide screen, whether its sheet is open on a narrow one, and a field waiting for its panel to
 * be shown before it takes focus. The open tool itself lives in the address (see ./tools).
 */

import type { ToolId } from "./tools";

/** A field to focus, and the tool whose panel holds it. */
export type PendingFocus = Readonly<{ field: string; tool: ToolId }>;

export interface WorkspaceLayout {
  /** Wide screens: the assistant is docked on the right, or collapsed to a button. */
  readonly dockOpen: boolean;
  /** Narrow screens: the assistant opens as a sheet over the workspace. */
  readonly sheetOpen: boolean;
  /** A field that asked for focus from a hidden panel. It is focused once its tool is shown. */
  readonly pendingFocus: PendingFocus | null;
  /** A part of a panel named by the address's #hash, scrolled to once its tool is shown. */
  readonly pendingScroll: PendingScroll | null;
}

/** An element to scroll to, by id, and the tool whose panel holds it. */
export type PendingScroll = Readonly<{ id: string; tool: ToolId }>;

export type LayoutEvent =
  | { readonly type: "toggleDock" }
  | { readonly type: "openSheet" }
  | { readonly type: "closeSheet" }
  | { readonly type: "reveal"; readonly field: string; readonly tool: ToolId }
  | { readonly type: "focused" }
  | { readonly type: "revealHash"; readonly id: string; readonly tool: ToolId }
  | { readonly type: "scrolled" };

export const INITIAL_LAYOUT: WorkspaceLayout = Object.freeze({
  dockOpen: true,
  sheetOpen: false,
  pendingFocus: null,
  pendingScroll: null,
});

export function layoutReducer(state: WorkspaceLayout, event: LayoutEvent): WorkspaceLayout {
  switch (event.type) {
    case "toggleDock":
      return { ...state, dockOpen: !state.dockOpen };
    case "openSheet":
      return { ...state, sheetOpen: true };
    case "closeSheet":
      return { ...state, sheetOpen: false };
    case "reveal":
      return { ...state, sheetOpen: false, pendingFocus: { field: event.field, tool: event.tool } };
    case "focused":
      return { ...state, pendingFocus: null };
    case "revealHash":
      return { ...state, sheetOpen: false, pendingScroll: { id: event.id, tool: event.tool } };
    case "scrolled":
      return { ...state, pendingScroll: null };
  }
}

/** The field to focus now that this tool is shown, if one is waiting for it. */
export function fieldToFocus(state: WorkspaceLayout, shown: ToolId): string | null {
  return state.pendingFocus?.tool === shown ? state.pendingFocus.field : null;
}

/** The element to scroll to now that this tool is shown, if one is waiting for it. */
export function idToScroll(state: WorkspaceLayout, shown: ToolId): string | null {
  return state.pendingScroll?.tool === shown ? state.pendingScroll.id : null;
}

/** The element id an address's #hash names, or null for none. */
export function hashTarget(hash: string): string | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return null;
  }
}
