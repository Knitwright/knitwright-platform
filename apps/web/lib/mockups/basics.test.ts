import { describe, expect, it } from "vitest";
import { DEFAULT_SAMPLE_NAME, DEFAULT_SAMPLE_NUMBER } from "@/lib/garment/names-numbers";
import { DRAWN_BY_US, allBackdrops, backdropFor } from "./backdrops";
import {
  ROSTER_NAME_DEFAULT,
  ROSTER_NAME_MAX,
  ROSTER_NUMBER_DEFAULT,
  colourwayForRole,
  defaultSettings,
  roleGap,
  rosterFrom,
  rosterLabel,
  rosterProblem,
  sceneSlugOf,
  settingsFrom,
  settingsToStored,
  staleAgainst,
  startingRoster,
} from "./board";
import { CROP_LABELS, EDGE_BOUNDS, MOCKUP_EDGE, canvasFor, isCrop, nearestCrop, ratioOf } from "./crops";
import { sceneBySlug } from "./scenes";
import { CROPS, type MockupScene } from "./types";
import { MIN_TURN_WIDTH, TURNTABLE_STEPS, frameAt, isDrawnStraight, isMirrored, sourceViewOf, squeezeFor, turnNote, turntableAngles, viewGap } from "./views";

const scene = (slug: string): MockupScene => {
  const found = sceneBySlug(slug);
  if (!found) throw new Error(`No scene ${slug}`);
  return found;
};

describe("the backdrops", () => {
  it("says of every one that we painted it, not that somebody photographed it", () => {
    for (const backdrop of allBackdrops()) expect(backdrop.note).toBe(DRAWN_BY_US);
    expect(allBackdrops().length).toBeGreaterThanOrEqual(7);
  });

  it("answers the e-commerce white for a key nobody seeded, which hides nothing", () => {
    expect(backdropFor("outfield").label).toBe("Outfield green");
    expect(backdropFor("no-such-backdrop").key).toBe("white");
  });

  it("gives a gradient backdrop a second colour and a flat one none", () => {
    expect(backdropFor("night").hexTwo).toMatch(/^#[0-9a-f]{6}$/);
    expect(backdropFor("white").hexTwo).toBeUndefined();
  });
});

describe("the crops", () => {
  it("makes the longer side the size asked for, whichever way round the crop is", () => {
    expect(canvasFor("1:1", 800)).toEqual({ width: 800, height: 800 });
    expect(canvasFor("4:5", 1000)).toEqual({ width: 800, height: 1000 });
    expect(canvasFor("9:16", 1600)).toEqual({ width: 900, height: 1600 });
    expect(canvasFor("16:9", 1600)).toEqual({ width: 1600, height: 900 });
  });

  it("uses the seeded edge when none is asked for, and labels every crop", () => {
    expect(canvasFor("1:1")).toEqual({ width: MOCKUP_EDGE, height: MOCKUP_EDGE });
    for (const crop of CROPS) expect(CROP_LABELS[crop]).toMatch(/\S/);
  });

  it("refuses a size the renderer will not work at, with the bound in the message", () => {
    expect(() => canvasFor("1:1", EDGE_BOUNDS.min - 1)).toThrow(/between 64 px and 4096 px/);
    expect(() => canvasFor("1:1", EDGE_BOUNDS.max + 1)).toThrow(/4096/);
  });

  it("knows a crop by name and finds the nearest one to a canvas", () => {
    expect(isCrop("4:5")).toBe(true);
    expect(isCrop("3:2")).toBe(false);
    expect(ratioOf("16:9")).toBeCloseTo(16 / 9);
    expect(nearestCrop({ width: 1080, height: 1350 })).toBe("4:5");
    expect(nearestCrop({ width: 1000, height: 1000 })).toBe("1:1");
  });
});

describe("the four views and how each one is made", () => {
  it("draws the front and the back straight, and derives the other two", () => {
    expect(isDrawnStraight("front")).toBe(true);
    expect(isDrawnStraight("back")).toBe(true);
    expect(isDrawnStraight("three-quarter")).toBe(false);
    expect(sourceViewOf("three-quarter")).toBe("front");
    expect(sourceViewOf("back")).toBe("back");
    expect(isMirrored("back")).toBe(false);
  });

  it("squeezes a turned view by the cosine of its turn, and never to nothing", () => {
    expect(squeezeFor("front")).toBe(1);
    expect(squeezeFor("back")).toBe(1);
    expect(squeezeFor("three-quarter")).toBeCloseTo(Math.cos(Math.PI / 4));
    expect(squeezeFor("side")).toBe(MIN_TURN_WIDTH);
  });

  it("says of a turned view what it is, and carries its gap", () => {
    expect(turnNote("front")).toBeNull();
    expect(viewGap("front")).toBeNull();
    expect(turnNote("three-quarter")).toContain("turned 45°");
    expect(turnNote("three-quarter")).toContain("not of fit or drape");
    const gap = viewGap("side");
    expect(gap?.ruleId).toBe("R-GAP-000");
    expect(gap?.line).toContain("3D model drawn on the server");
  });

  it("turns the garment all the way round for a turntable, from the right drawing each time", () => {
    expect(turntableAngles()).toEqual([0, 45, 90, 135, 180, 225, 270, 315]);
    expect(turntableAngles()).toHaveLength(TURNTABLE_STEPS);
    expect(turntableAngles(4)).toEqual([0, 90, 180, 270]);
    expect(frameAt(0)).toEqual({ from: "front", squeeze: 1, mirrored: false });
    expect(frameAt(180)).toEqual({ from: "back", squeeze: 1, mirrored: false });
    expect(frameAt(225).from).toBe("back");
    expect(frameAt(225).mirrored).toBe(true);
    expect(frameAt(-45).from).toBe("front");
    expect(frameAt(90).squeeze).toBe(MIN_TURN_WIDTH);
  });

  it("refuses a turntable with too few or too many frames", () => {
    expect(() => turntableAngles(1)).toThrow(/between 2 and 72/);
    expect(() => turntableAngles(73)).toThrow(/between 2 and 72/);
    expect(() => turntableAngles(2.5)).toThrow(/between 2 and 72/);
  });
});

describe("a mockup board's settings", () => {
  const front = scene("product-front");

  it("starts on the scene's own first crop, the home kit and no roster", () => {
    expect(defaultSettings(front)).toEqual({ sceneSlug: "product-front", crop: front.crops[0], kitRole: "home", colourwayId: null, roster: null, edge: MOCKUP_EDGE });
    expect(defaultSettings(scene("ecommerce-white-four-five")).crop).toBe("4:5");
  });

  it("carries no placement at all, because the scene fixes it", () => {
    expect(Object.keys(settingsToStored(defaultSettings(front)))).toEqual(["sceneSlug", "crop", "kitRole", "colourwayId", "roster", "edge"]);
  });

  it("reads back what it stored, and falls back rather than refusing to draw", () => {
    const stored = settingsToStored({ ...defaultSettings(front), crop: "4:5", kitRole: "goalkeeper", colourwayId: "away", roster: { name: "SMITH", number: "7" }, edge: 512 });
    expect(settingsFrom(stored, front)).toEqual({ sceneSlug: "product-front", crop: "4:5", kitRole: "goalkeeper", colourwayId: "away", roster: { name: "SMITH", number: "7" }, edge: 512 });
    expect(settingsFrom({}, front)).toEqual(defaultSettings(front));
    // A crop the scene does not offer, and a role nobody has heard of, fall back to the default.
    expect(settingsFrom({ crop: "9:16", kitRole: "reserve" }, scene("ecommerce-white-square")).crop).toBe("1:1");
    expect(settingsFrom({ kitRole: "reserve" }, front).kitRole).toBe("home");
    expect(settingsFrom({ edge: Number.NaN }, front).edge).toBe(MOCKUP_EDGE);
  });

  it("names the scene a board is on, or says there is none", () => {
    expect(sceneSlugOf({ sceneSlug: "product-back" })).toBe("product-back");
    expect(sceneSlugOf({ sceneSlug: "  " })).toBeNull();
    expect(sceneSlugOf({})).toBeNull();
  });

  it("reads a roster entry only when both halves are there and within the design's own rules", () => {
    expect(rosterFrom({ name: "SMITH", number: "7" })).toEqual({ name: "SMITH", number: "7" });
    expect(rosterFrom({ name: "SMITH" })).toBeNull();
    expect(rosterFrom({ name: "S".repeat(ROSTER_NAME_MAX + 1), number: "7" })).toBeNull();
    expect(rosterFrom({ name: "SMITH", number: "123" })).toBeNull();
    expect(rosterFrom(null)).toBeNull();
    expect(rosterFrom("SMITH 7")).toBeNull();
  });

  it("writes a shirt the way F-L1 writes it, and starts from the design's own sample", () => {
    expect(rosterLabel({ name: "SMITH", number: "7" })).toBe("SMITH 7");
    expect(rosterLabel(null)).toBe("");
    expect(startingRoster()).toEqual({ name: ROSTER_NAME_DEFAULT, number: ROSTER_NUMBER_DEFAULT });
  });

  it("keeps the design's own limits rather than inventing its own", () => {
    expect(ROSTER_NAME_DEFAULT).toBe(DEFAULT_SAMPLE_NAME);
    expect(ROSTER_NUMBER_DEFAULT).toBe(DEFAULT_SAMPLE_NUMBER);
  });

  it("says why a roster entry was refused, in words a person can act on", () => {
    expect(rosterProblem("", "7")).toBe("Type a name, such as SMITH.");
    expect(rosterProblem("S".repeat(21), "7")).toContain("at most 20 characters");
    expect(rosterProblem("SMITH", "700")).toBe("Type a number from 0 to 99.");
    expect(rosterProblem("SMITH", "00")).toBeNull();
  });
});

describe("the live link to the design version", () => {
  it("says nothing while a board has never been drawn, or is already on the newest version", () => {
    expect(staleAgainst(null, 3)).toEqual({ stale: false, line: "" });
    expect(staleAgainst(3, null)).toEqual({ stale: false, line: "" });
    expect(staleAgainst(3, 3).stale).toBe(false);
  });

  it("says which version it was drawn from when the design has moved on", () => {
    const stale = staleAgainst(2, 5);
    expect(stale.stale).toBe(true);
    expect(stale.line).toContain("version 2");
    expect(stale.line).toContain("version 5");
  });
});

describe("the kit roles and the design's own colourways", () => {
  const colourways = [
    { id: "a", name: "Home" },
    { id: "b", name: "Away red" },
    { id: "c", name: "Keeper green" },
  ];

  it("finds a colourway by the design's own name, goalkeeper under any of its three words", () => {
    expect(colourwayForRole("home", colourways)).toBe("a");
    expect(colourwayForRole("away", colourways)).toBe("b");
    expect(colourwayForRole("goalkeeper", colourways)).toBe("c");
    expect(colourwayForRole("goalkeeper", [{ id: "d", name: "GK third" }])).toBe("d");
  });

  it("says so rather than renaming anything when no colourway matches a role", () => {
    expect(roleGap("home", colourways)).toBeNull();
    const gap = roleGap("goalkeeper", [{ id: "a", name: "First" }]);
    expect(gap?.ruleId).toBe("R-GAP-000");
    expect(gap?.line).toContain("no colourway named for the goalkeeper kit");
  });
});
