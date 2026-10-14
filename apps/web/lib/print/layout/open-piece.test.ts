import { describe, expect, it } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { boundsOf, polygonArea } from "../geometry/vec";
import { openPiece } from "./open-piece";

const piece = (id: string) => JERSEY_EU48.piecesBySize["48"].find((p) => p.id === id)!;

describe("openPiece", () => {
  it("opens a front cut on the fold into the whole piece, centred on the fold line", () => {
    const opened = openPiece(piece("front"), "whole");
    const b = boundsOf(opened.outline);
    expect(b.minY).toBeCloseTo(-259.73, 1);
    expect(b.maxY).toBeCloseTo(259.73, 1);
    expect(polygonArea(opened.outline)).toBeCloseTo(2 * polygonArea(piece("front").cutOutline), 0);
  });
  it("opens a back cut on the fold about its own fold line", () => {
    const opened = openPiece(piece("back"), "whole");
    const b = boundsOf(opened.outline);
    expect(b.minY).toBeCloseTo(0, 1);
    expect(b.maxY).toBeCloseTo(2 * 259.73, 1);
  });
  it("keeps the landmarks and adds the mirrored copies of those off the fold", () => {
    const opened = openPiece(piece("front"), "whole");
    expect(opened.landmarks.hps).toEqual(piece("front").landmarks.hps);
    expect(opened.mirroredLandmarks["shoulder-point"]![1]).toBeCloseTo(-191.45, 1);
  });
  it("leaves a sleeve as cut for the right and mirrors it for the left", () => {
    const right = openPiece(piece("sleeve"), "right");
    const left = openPiece(piece("sleeve"), "left");
    expect(right.outline).toEqual(piece("sleeve").cutOutline);
    expect(polygonArea(left.outline)).toBeCloseTo(polygonArea(right.outline), 6);
    // The cap top sits on the long axis, so the mirror about that axis leaves it where it was.
    expect(left.landmarks["cap-top"]![1]).toBeCloseTo(right.landmarks["cap-top"]![1], 6);
    expect(left.landmarks["underarm-a"]![1]).toBeCloseTo(2 * 176.8 - right.landmarks["underarm-a"]![1], 1);
  });
  it("refuses a whole piece asked for as a side, and a side asked for on a piece that is not a pair", () => {
    expect(() => openPiece(piece("front"), "left")).toThrow(/pair/);
    expect(() => openPiece(piece("sleeve"), "whole")).toThrow(/pair/);
  });
  it("opens the collar", () => {
    const opened = openPiece(piece("collar"), "whole");
    const b = boundsOf(opened.outline);
    expect(b.maxY - b.minY).toBeCloseTo(2 * 212.9, 0);
  });
});
