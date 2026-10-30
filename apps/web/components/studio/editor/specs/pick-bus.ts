"use client";

import type { PickedPoint } from "@/lib/techpack/view";

/**
 * How a place picked on a view reaches the Specs toolbar.
 *
 * Spec F-S4 and F-S6 want the toolbar's tools drawn **on the 2D view, and on the 3D view where the
 * viewer supports picking**. Neither of those views belongs to this workstream: the 2D pattern view
 * is Y3's slot and the 3D viewer is the shell's. So this is the seam, defined in the smallest shape
 * that works (plan v5, lesson 9): a view that can report where a person clicked calls `reportPick`,
 * and the toolbar listens while one of its drawing tools is held.
 *
 * Until a view calls it, the toolbar's own fields are the way a place is given, which is also the
 * way a person who cannot use a pointer gives one. That is not a workaround kept quiet: the toolbar
 * says which views report a pick, and it says it from this list, so the sentence cannot go stale.
 */

export type PickListener = (point: PickedPoint) => void;

const listeners = new Set<PickListener>();

/** The views that report a pick today. A view is added here by the workstream that teaches it to. */
export const PICKING_VIEWS: readonly Readonly<{ view: "2d" | "3d"; label: string; reports: boolean }>[] = [
  { view: "2d", label: "the 2D pattern view", reports: false },
  { view: "3d", label: "the 3D view", reports: false },
];

/** One sentence saying where a place can be picked, read from the list above. */
export function pickingNote(): string {
  const reporting = PICKING_VIEWS.filter((entry) => entry.reports).map((entry) => entry.label);
  if (reporting.length === 0) return "No view reports where you click yet, so give the place below.";
  return `Click on ${reporting.join(" or ")}, or give the place below.`;
}

/** A view says where a person picked. Every listening toolbar is told. */
export function reportPick(point: PickedPoint): void {
  for (const listener of [...listeners]) listener(point);
}

/** Listen while a drawing tool is held. The returned function stops listening. */
export function listenForPicks(listener: PickListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** TEST SUPPORT. Drops every listener, so one test cannot be heard by another. */
export const resetPicks = (): void => listeners.clear();
