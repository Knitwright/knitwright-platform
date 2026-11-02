import { describe, expect, it } from "vitest";
import { backdropFor, cameraAngleFor, parseView, snapshotName, turntableSecondsFor, TURNTABLE_SECONDS, viewChips } from "./stage";
import { BACKDROPS, FIRST_RENDER_BUDGET_MS, RAIL_TOOLS, sportById, STAGE_VIEWS, withinFirstRenderBudget } from "./vocabulary";

describe("the view chip", () => {
  it("offers the five views the spec names, in its own order", () => {
    expect(STAGE_VIEWS).toEqual(["front", "back", "left", "right", "collar"]);
    expect(viewChips("back").filter((chip) => chip.showing).map((chip) => chip.id)).toEqual(["back"]);
    expect(viewChips("front")).toHaveLength(5);
  });

  it("reads a view out of an address and falls back to the front", () => {
    expect(parseView("collar")).toBe("collar");
    expect(parseView(["right", "left"])).toBe("right");
    expect(parseView("inside-out")).toBe("front");
    expect(parseView(undefined)).toBe("front");
  });

  it("stands the camera on opposite sides for front and back, and above for the collar", () => {
    expect(cameraAngleFor("front").azimuthDegrees).toBe(0);
    expect(cameraAngleFor("back").azimuthDegrees).toBe(180);
    expect(cameraAngleFor("left").azimuthDegrees).toBe(-90);
    expect(cameraAngleFor("right").azimuthDegrees).toBe(90);
    expect(cameraAngleFor("collar").polarDegrees).toBeLessThan(cameraAngleFor("front").polarDegrees);
    expect(cameraAngleFor("collar").distanceFactor).toBeLessThan(1);
  });
});

describe("the backdrop", () => {
  it("names a backdrop the stage can draw, with words for a reader who cannot see it", () => {
    const backdrop = backdropFor("football");
    expect(BACKDROPS).toContain(backdrop.id);
    expect(backdrop.label).toBe("A grass pitch");
  });

  it("falls back to the first sport's backdrop for a sport nobody offers", () => {
    expect(backdropFor("quidditch")).toEqual(backdropFor(sportById("quidditch").id));
  });
});

describe("the turntable and the snapshot", () => {
  it("turns once in a fixed number of seconds, and not at all for a person who asked for less motion", () => {
    expect(turntableSecondsFor(false)).toBe(TURNTABLE_SECONDS);
    expect(turntableSecondsFor(true)).toBeNull();
  });

  it("names a snapshot after the sport, the view and the day, so two pictures can be told apart", () => {
    expect(snapshotName("football", "back", new Date("2026-11-20T09:00:00Z"))).toBe("knitwright-kit-football-back-2026-11-20.png");
    expect(snapshotName("quidditch", "front", new Date("2026-01-02T00:00:00Z"))).toBe("knitwright-kit-football-front-2026-01-02.png");
  });
});

describe("the first render budget", () => {
  it("is the three seconds the spec's acceptance test names", () => {
    expect(FIRST_RENDER_BUDGET_MS).toBe(3_000);
  });

  it("passes a render inside the budget and fails one outside it", () => {
    expect(withinFirstRenderBudget(0)).toBe(true);
    expect(withinFirstRenderBudget(2_999)).toBe(true);
    expect(withinFirstRenderBudget(3_000)).toBe(false);
    expect(withinFirstRenderBudget(9_000)).toBe(false);
  });

  it("fails a measurement that is not a number of milliseconds", () => {
    expect(withinFirstRenderBudget(Number.NaN)).toBe(false);
    expect(withinFirstRenderBudget(Number.POSITIVE_INFINITY)).toBe(false);
    expect(withinFirstRenderBudget(-1)).toBe(false);
  });
});

describe("the tool rail", () => {
  it("holds the seven tools the spec draws, undo and redo first", () => {
    expect(RAIL_TOOLS).toEqual(["undo", "redo", "add-element", "ideas", "play", "fullscreen", "snapshot"]);
  });
});
