import { describe, expect, it } from "vitest";
import { allSettled, isSettled, resolutionsOf, type LineView, type PreviewView } from "./model";

const RUN = ["S", "M", "L"];
const line = (index: number, reasons: LineView["reasons"]): LineView => ({
  index,
  row: { name: "P", number: "1", sizeLabel: "XL", cut: "mens", quantity: 1 },
  reasons,
  messages: [],
  change: "same",
  previousSize: null,
});
const plan = (lines: LineView[]): PreviewView["plan"] => ({ lines, run: RUN, counts: { ready: 0, fix: 0, sizeChanged: 0, newPlayers: 0 } });

describe("isSettled", () => {
  it("is true for a ready line", () => expect(isSettled(line(0, []), RUN, undefined)).toBe(true));
  it("needs a size from the run for a removed size", () => {
    expect(isSettled(line(0, ["size-removed"]), RUN, undefined)).toBe(false);
    expect(isSettled(line(0, ["size-removed"]), RUN, { sizeLabel: "XL" })).toBe(false);
    expect(isSettled(line(0, ["size-removed"]), RUN, { sizeLabel: "L" })).toBe(true);
  });
  it("needs a valid number for a missing one", () => {
    expect(isSettled(line(0, ["no-number"]), RUN, { number: "x" })).toBe(false);
    expect(isSettled(line(0, ["no-number"]), RUN, { number: "9" })).toBe(true);
  });
  it("needs keep or leave out for a player who left", () => {
    expect(isSettled(line(0, ["player-left"]), RUN, undefined)).toBe(false);
    expect(isSettled(line(0, ["player-left"]), RUN, { action: "keep" })).toBe(true);
    expect(isSettled(line(0, ["player-left", "size-removed"]), RUN, { action: "keep" })).toBe(false);
    expect(isSettled(line(0, ["player-left", "size-removed"]), RUN, { action: "keep", sizeLabel: "S" })).toBe(true);
    expect(isSettled(line(0, ["player-left"]), RUN, { action: "leave-out" })).toBe(true);
  });
});

describe("allSettled and resolutionsOf", () => {
  const p = plan([line(0, []), line(1, ["size-removed"])]);
  it("waits for every line", () => {
    expect(allSettled(p, {})).toBe(false);
    expect(allSettled(p, { 1: { sizeLabel: "M" } })).toBe(true);
  });
  it("sends answers only for lines that needed one", () => {
    expect(resolutionsOf(p, { 1: { sizeLabel: "M" } })).toEqual([{ index: 1, sizeLabel: "M" }]);
    expect(resolutionsOf(plan([line(0, [])]), {})).toEqual([]);
    expect(resolutionsOf(p, {})).toEqual([{ index: 1 }]);
  });
});
