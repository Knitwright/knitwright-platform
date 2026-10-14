import { describe, expect, it } from "vitest";
import { candidatesFor, NUDGES } from "./estimate";

const measured = (over: Partial<Parameters<typeof candidatesFor>[0]> = {}) => ({ xMm: 40, yMm: 40, inkShare: 0.3, inks: 1, ...over });

describe("candidatesFor", () => {
  it("starts dots from the pitch, a row step of half the vertical repeat, and a width from the ink's share", () => {
    const dots = candidatesFor(measured()).filter((c) => c.generatorId === "kit-dots");
    expect(dots.map((c) => c.start.halfDrop)).toEqual([true, false]);
    expect(dots[0].start).toMatchObject({ pitchMm: 40, rowStepMm: 20 });
    expect(dots[1].start).toMatchObject({ pitchMm: 40, rowStepMm: 40 });
    // Two dots in a cell of 40 by 40 mm that is 30 % ink: each is 6 mm radius or so.
    expect(Number(dots[0].start.dotWidthMm)).toBeCloseTo(2 * Math.sqrt((0.3 * 1600) / (2 * Math.PI)), 5);
    expect(dots[0]).toMatchObject({ movesWithDatum: false, tune: ["dotWidthMm", "pitchMm", "rowStepMm"] });
  });

  it("adds a two-ink straight-row variant when there are two inks, and keeps a dot narrower than its pitch", () => {
    const dots = candidatesFor(measured({ inks: 2, inkShare: 0.95 })).filter((c) => c.generatorId === "kit-dots");
    expect(dots).toHaveLength(3);
    expect(dots[2].start).toMatchObject({ halfDrop: false, rowStepMm: 20 });
    for (const c of dots) expect(Number(c.start.dotWidthMm)).toBeLessThanOrEqual(40 * 0.95);
  });

  it("reads stripes from one repeat, or from both when they lean", () => {
    const stripes = (m: Parameters<typeof candidatesFor>[0]) => candidatesFor(m).filter((c) => c.generatorId === "stripe-variations");
    expect(stripes(measured({ yMm: null })).map((c) => c.start)).toEqual([{ rhythm: 0, width: 20, angle: 90, grow: 0.5 }]);
    expect(stripes(measured({ xMm: null })).map((c) => c.start)).toEqual([{ rhythm: 0, width: 20, angle: 0, grow: 0.5 }]);
    const lean = stripes(measured({ xMm: 56.57, yMm: 56.57 }));
    expect(lean.map((c) => Number(c.start.angle)).sort((a, b) => a - b)).toEqual([45, 135]);
    expect(Number(lean[0].start.width)).toBeCloseTo(20, 0);
    expect(lean[0].movesWithDatum).toBe(true);
  });

  it("tries camo once at a scale from the repeat, and nothing when there is no repeat", () => {
    expect(candidatesFor(measured({ xMm: 90, yMm: 120 })).filter((c) => c.generatorId === "camo").map((c) => c.start)).toEqual([{ scale: 45 }]);
    expect(candidatesFor(measured({ xMm: 10, yMm: null })).find((c) => c.generatorId === "camo")?.start).toEqual({ scale: 30 });
    expect(candidatesFor(measured({ xMm: null, yMm: null }))).toEqual([]);
  });

  it("nudges from large to small", () => {
    expect([...NUDGES]).toEqual([...NUDGES].sort((a, b) => b - a));
  });
});
