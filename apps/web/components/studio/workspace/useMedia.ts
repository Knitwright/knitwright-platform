"use client";

import { useSyncExternalStore } from "react";

/** The lg and xl breakpoints of the workspace, as media queries. */
export const LG = "(min-width: 64rem)";
export const XL = "(min-width: 80rem)";

/**
 * Whether a media query matches. The server, which has no screen, assumes a wide one, and the
 * browser corrects it straight after hydration.
 */
export const useMedia = (query: string): boolean =>
  useSyncExternalStore(
    (changed) => {
      const list = window.matchMedia(query);
      list.addEventListener("change", changed);
      return () => list.removeEventListener("change", changed);
    },
    () => window.matchMedia(query).matches,
    () => true,
  );
