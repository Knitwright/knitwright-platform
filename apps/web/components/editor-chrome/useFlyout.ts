"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { CLOSED, panelFlyout, pressed, type Flyout, type RailEntryId } from "@/lib/editor-chrome";
import type { LaunchCommands, LaunchPanelId, RailId } from "@/lib/launch";
import { RAIL_ITEMS } from "@/lib/launch";

const LABELS_KEY = "kw.editor.menu-labels";

/** The per-viewer "Menu labels" choice. Browser storage may be missing or refused: labels then stay on. */
function readLabels(): boolean {
  try {
    return window.localStorage.getItem(LABELS_KEY) !== "off";
  } catch {
    return true;
  }
}

const told = new Set<() => void>();
const subscribe = (listener: () => void) => {
  told.add(listener);
  return () => {
    told.delete(listener);
  };
};

/** Keeps `?fly=` in the address for the editor's own flyouts, so a reload opens where the person was. */
function writeFly(flyout: Flyout): void {
  try {
    const url = new URL(window.location.href);
    if (flyout.kind === "own") url.searchParams.set("fly", flyout.id);
    else if (flyout.kind === "closed") url.searchParams.set("fly", "none");
    else url.searchParams.delete("fly");
    window.history.replaceState(window.history.state, "", url);
  } catch {
    // An address that cannot be rewritten only means a reload opens the default flyout.
  }
}

/**
 * Which flyout is open beside the rail, and whether the rail shows its words (decision 0146). A
 * flyout that is a launch panel is opened through the shell's own `openPanel`, so the address's
 * `?panel=` and every panel that reads it keep working; a panel that asks the shell for another
 * panel moves the flyout with it (`openPanel` below, handed to the panels in place of the shell's).
 */
export function useFlyout(initial: Flyout, commands: LaunchCommands) {
  const [flyout, setFlyout] = useState<Flyout>(initial);
  const labels = useSyncExternalStore(subscribe, readLabels, () => true);

  const show = useCallback(
    (next: Flyout) => {
      setFlyout(next);
      writeFly(next);
      if (next.kind === "panel") commands.openPanel(next.id);
    },
    [commands],
  );

  const press = (entry: RailEntryId) => show(pressed(flyout, entry));
  const close = () => show(CLOSED);

  const openPanel = (id: LaunchPanelId) => {
    if ((RAIL_ITEMS as readonly string[]).includes(id)) show(panelFlyout(id as RailId));
    else commands.openPanel(id);
  };

  const setLabels = (on: boolean) => {
    try {
      window.localStorage.setItem(LABELS_KEY, on ? "on" : "off");
    } catch {
      // Storage refused: the labels stay as they were.
    }
    for (const listener of told) listener();
  };

  return { flyout, show, press, close, openPanel, labels, setLabels };
}
