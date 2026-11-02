import { describe, expect, it } from "vitest";
import { placements, repeatPeriod, styleFlip, styleShift, tileCount } from "./tiling";
import { REPEAT_STYLES } from "./types";

/** The four repeat styles of spec F-S4, each laid out by the rule its name describes. */

const tile = { widthTenths: 1000, heightTenths: 600 };
const area = { widthTenths: 2000, heightTenths: 1200 };

describe("how a tile is laid out", () => {
  it("has the spec's four styles in the spec's order", () => {
    expect(REPEAT_STYLES).toEqual(["full-drop", "half-drop", "brick", "mirror"]);
  });

  it("moves nothing in a full drop", () => {
    expect(styleShift("full-drop", 1, 1, tile)).toEqual({ dx: 0, dy: 0 });
    expect(styleFlip("full-drop", 1, 1)).toEqual({ flipX: false, flipY: false });
  });

  it("drops every second column by half the tile in a half-drop", () => {
    expect(styleShift("half-drop", 0, 0, tile)).toEqual({ dx: 0, dy: 0 });
    expect(styleShift("half-drop", 1, 0, tile)).toEqual({ dx: 0, dy: 300 });
    expect(styleShift("half-drop", 2, 0, tile)).toEqual({ dx: 0, dy: 0 });
    expect(styleShift("half-drop", 3, 7, tile)).toEqual({ dx: 0, dy: 300 });
    // A column before the start is shifted the same way, so the top edge is covered.
    expect(styleShift("half-drop", -1, 0, tile)).toEqual({ dx: 0, dy: 300 });
  });

  it("shifts every second row across by half the tile in a brick", () => {
    expect(styleShift("brick", 0, 0, tile)).toEqual({ dx: 0, dy: 0 });
    expect(styleShift("brick", 0, 1, tile)).toEqual({ dx: 500, dy: 0 });
    expect(styleShift("brick", 4, 2, tile)).toEqual({ dx: 0, dy: 0 });
  });

  it("flips every second column and row in a mirror, and moves nothing", () => {
    expect(styleShift("mirror", 1, 1, tile)).toEqual({ dx: 0, dy: 0 });
    expect(styleFlip("mirror", 0, 0)).toEqual({ flipX: false, flipY: false });
    expect(styleFlip("mirror", 1, 0)).toEqual({ flipX: true, flipY: false });
    expect(styleFlip("mirror", 0, 1)).toEqual({ flipX: false, flipY: true });
    expect(styleFlip("mirror", 1, 1)).toEqual({ flipX: true, flipY: true });
    expect(styleFlip("mirror", -1, -1)).toEqual({ flipX: true, flipY: true });
  });

  it("says what repeats once: the print file's own block", () => {
    expect(repeatPeriod("full-drop", tile)).toEqual({ widthTenths: 1000, heightTenths: 600 });
    expect(repeatPeriod("half-drop", tile)).toEqual({ widthTenths: 2000, heightTenths: 600 });
    expect(repeatPeriod("brick", tile)).toEqual({ widthTenths: 1000, heightTenths: 1200 });
    expect(repeatPeriod("mirror", tile)).toEqual({ widthTenths: 2000, heightTenths: 1200 });
  });
});

describe("covering an area with tiles", () => {
  it("lays a plain grid from the corner for a full drop", () => {
    const laid = placements("full-drop", tile, area);
    expect(laid[0]).toEqual({ column: 0, row: 0, xTenths: 0, yTenths: 0, flipX: false, flipY: false });
    expect(laid.every((entry) => entry.column >= 0 && entry.row >= 0)).toBe(true);
    // Three columns and three rows: the last of each covers the far edge.
    expect(laid).toHaveLength(9);
  });

  it("starts a column early where the style drops, so the top edge is not left bare", () => {
    const laid = placements("half-drop", tile, area);
    expect(laid.some((entry) => entry.column === -1)).toBe(true);
    expect(laid.some((entry) => entry.row === -1)).toBe(false);
    const shifted = laid.find((entry) => entry.column === 1 && entry.row === 0);
    expect(shifted?.yTenths).toBe(300);
  });

  it("starts a row early where the style shifts across", () => {
    const laid = placements("brick", tile, area);
    expect(laid.some((entry) => entry.row === -1)).toBe(true);
    expect(laid.find((entry) => entry.column === 0 && entry.row === 1)?.xTenths).toBe(500);
  });

  it("starts both early for a mirror and flips the right tiles", () => {
    const laid = placements("mirror", tile, area);
    expect(laid.some((entry) => entry.column === -1 && entry.row === -1)).toBe(true);
    expect(laid.find((entry) => entry.column === 1 && entry.row === 1)).toMatchObject({ flipX: true, flipY: true });
  });

  it("lays nothing for a tile with no size", () => {
    expect(placements("full-drop", { widthTenths: 0, heightTenths: 600 }, area)).toEqual([]);
    expect(placements("full-drop", { widthTenths: 1000, heightTenths: -1 }, area)).toEqual([]);
  });

  it("stops rather than laying millions of tiles across a pitch", () => {
    const many = placements("full-drop", { widthTenths: 100, heightTenths: 100 }, { widthTenths: 1_000_000, heightTenths: 1_000_000 });
    expect(many).toHaveLength(4096);
  });

  it("counts the tiles it would lay", () => {
    expect(tileCount("full-drop", tile, area)).toBe(9);
    expect(tileCount("mirror", tile, area)).toBeGreaterThan(9);
  });
});
