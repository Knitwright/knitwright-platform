import { describe, expect, it } from "vitest";
import { BOARD_KINDS, LAUNCH_PANELS, PANEL_OF_KIND, RAIL_ITEMS, type LaunchPanelId } from "@/lib/launch";
import { BOARD_PANELS } from "./Inspector";
import { RAIL_PANELS } from "./RailPanels";

/**
 * WHICH PANELS ARE REALLY MOUNTED (the wiring of wave 4).
 *
 * A panel is mounted by a lookup, and a lookup that misses is silent: the shell draws the labelled
 * placeholder instead and nothing says the id and the map disagree. The browser tests would catch
 * it, but they run after the merge and a map key is a typo away. So this file reads the maps.
 *
 * It also holds the two lists that are the point of this change: what is mounted, and what is
 * deliberately still a placeholder. A workstream landing a panel changes this file, which is the
 * one place to look for "what is left".
 */

/**
 * The ids nothing fills yet. `likes` is the only one left, and it is left on purpose: nothing in
 * the platform records a like, so the panel says whose it is rather than showing an empty shelf
 * with a heart on it (decision 0108's own owner question).
 */
const PLACEHOLDERS: Readonly<Record<string, string>> = { likes: "L8" };

describe("the rail's panels", () => {
  it("mounts every rail panel but Likes, which nothing can fill yet", () => {
    const left = RAIL_ITEMS.filter((id) => RAIL_PANELS[id] === undefined);

    expect([...left].sort()).toEqual(Object.keys(PLACEHOLDERS).sort());
  });

  it("maps nothing to an id that is not a panel of the contract", () => {
    const known: readonly string[] = LAUNCH_PANELS;

    expect(Object.keys(RAIL_PANELS).filter((id) => !known.includes(id))).toEqual([]);
  });
});

describe("a board's own panel", () => {
  it("has one for every board kind the contract gives a panel id", () => {
    const missing = BOARD_KINDS.map((kind) => PANEL_OF_KIND[kind])
      .filter((id): id is LaunchPanelId => id !== null)
      .filter((id) => BOARD_PANELS[id] === undefined);

    // Every board kind is answered now: a selected board never draws a placeholder.
    expect(missing).toEqual([]);
  });

  it("maps nothing to an id that is not a panel of the contract", () => {
    const known: readonly string[] = LAUNCH_PANELS;

    expect(Object.keys(BOARD_PANELS).filter((id) => !known.includes(id))).toEqual([]);
  });

  it("answers the ids the board table names, and L4's marketing board among them", () => {
    expect(PANEL_OF_KIND.marketing).toBe("board-marketing");
    expect(BOARD_PANELS["board-marketing"]).toBeTypeOf("function");
    expect(BOARD_PANELS["board-ai-image"]).toBeTypeOf("function");
    expect(BOARD_PANELS["board-ai-video"]).toBeTypeOf("function");
    expect(BOARD_PANELS["board-info-card"]).toBeTypeOf("function");
    expect(BOARD_PANELS["board-mockup"]).toBeTypeOf("function");
  });
});

describe("what is left", () => {
  it("leaves only the run summary outside both maps, because it is neither a rail nor a board panel", () => {
    const unmounted = LAUNCH_PANELS.filter((id) => RAIL_PANELS[id] === undefined && BOARD_PANELS[id] === undefined);

    expect([...unmounted].sort()).toEqual([...Object.keys(PLACEHOLDERS), "flow-run"].sort());
  });
});
