import { describe, expect, it } from "vitest";
import {
  chain,
  circle,
  closedCommands,
  curveTo,
  endOf,
  joinChains,
  lineTo,
  mirrorChain,
  openCommands,
  pt,
  quarterDown,
  reverseChain,
  shiftChain,
  tidy,
} from "./chain";

const sample = chain(pt(10, 0), lineTo(pt(20, 5)), curveTo(pt(30, 10), pt(30, 20), pt(20, 30)));

describe("chains", () => {
  it("know where they end, and an empty chain ends where it starts", () => {
    expect(endOf(sample)).toEqual(pt(20, 30));
    expect(endOf(chain(pt(3, 4)))).toEqual(pt(3, 4));
  });

  it("mirror about the centre line without changing the original", () => {
    const frozen = JSON.stringify(sample);
    const mirrored = mirrorChain(sample);
    expect(mirrored.start).toEqual(pt(-10, 0));
    expect(mirrored.pieces[1]).toEqual({ c1: pt(-30, 10), c2: pt(-30, 20), to: pt(-20, 30) });
    expect(JSON.stringify(sample)).toBe(frozen);
  });

  it("reverse into the same shape drawn the other way", () => {
    const back = reverseChain(sample);
    expect(back.start).toEqual(pt(20, 30));
    expect(back.pieces).toEqual([curveTo(pt(30, 20), pt(30, 10), pt(20, 5)), lineTo(pt(10, 0))]);
    expect(reverseChain(back)).toEqual(sample);
  });

  it("shift by the same amount everywhere", () => {
    const moved = shiftChain(sample, 5, -5);
    expect(moved.start).toEqual(pt(15, -5));
    expect(moved.pieces[1]).toEqual({ c1: pt(35, 5), c2: pt(35, 15), to: pt(25, 25) });
  });

  it("join end to start, closing a gap with a straight line", () => {
    const next = chain(pt(0, 40), lineTo(pt(0, 50)));
    const joined = joinChains(sample, next);
    expect(joined.pieces).toHaveLength(4);
    expect(joined.pieces[2]).toEqual(lineTo(pt(0, 40)));
    const touching = joinChains(sample, chain(pt(20, 30), lineTo(pt(1, 1))));
    expect(touching.pieces).toHaveLength(3);
  });

  it("become open or closed path commands", () => {
    expect(openCommands(sample).map((command) => command.op)).toEqual(["M", "L", "C"]);
    expect(closedCommands(sample, sample).map((command) => command.op)).toEqual(["M", "L", "C", "Z", "M", "L", "C", "Z"]);
  });

  it("make quarter ellipses that start and end where they should", () => {
    const piece = quarterDown(90, 40);
    expect(piece.to).toEqual(pt(0, 40));
    expect(piece.c1?.x).toBe(90);
    expect(piece.c2?.y).toBe(40);
  });

  it("make a circle of four curves that closes on itself", () => {
    const ring = circle(pt(5, 5), 2);
    expect(ring.pieces).toHaveLength(4);
    expect(endOf(ring)).toEqual(ring.start);
  });

  it("round to a tenth and never return minus zero", () => {
    expect(tidy(1.26)).toBe(1.3);
    expect(Object.is(tidy(-0.01), 0)).toBe(true);
  });
});
