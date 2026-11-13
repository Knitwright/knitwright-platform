"use client";

import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import { createCanvasStore, type CanvasState, type CanvasStore } from "@/lib/canvas";

/**
 * The canvas store in React (decision 0145). One store per open canvas, made by the provider and
 * read anywhere under it:
 *
 *   const scale = useCanvas((state) => state.viewport.scale);
 *   const store = useCanvasStore();   // the commands: select, toggle, zoomTo, fit, reveal…
 *
 * A selector must return a part of the state, or a primitive -- never a new object or array, which
 * would never settle (`useSyncExternalStore` compares by identity): the store replaces only what changed,
 * so a selector over an unchanged part returns the same object and nothing re-renders.
 */

const StoreContext = createContext<CanvasStore | null>(null);

export function CanvasStoreProvider({ initial, children }: Readonly<{ initial?: Partial<CanvasState>; children: ReactNode }>) {
  const [store] = useState(() => createCanvasStore(initial));
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

/** The store's commands. Throws outside a provider, which is a mistake in the page, not a state. */
export function useCanvasStore(): CanvasStore {
  const store = useContext(StoreContext);
  if (store === null) throw new Error("useCanvasStore needs a CanvasStoreProvider above it.");
  return store;
}

/** A part of the canvas state, re-read whenever it changes. */
export function useCanvas<T>(selector: (state: CanvasState) => T): T {
  const store = useCanvasStore();
  return useSyncExternalStore(
    store.subscribe,
    () => selector(store.getState()),
    () => selector(store.getState()),
  );
}
