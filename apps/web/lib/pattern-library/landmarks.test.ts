import { describe, expect, it } from "vitest";
import type { Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { cleanOverrides, detectLandmarks, distinctPoints, missingLandmarks, pieceRole, withOverrides } from "./landmarks";

const piece = (id: string) => JERSEY_EU48.piecesBySize["48"].find((p) => p.id === id) as (typeof JERSEY_EU48.piecesBySize)["48"][number];

describe("pieceRole", () => {
  it("knows the four pieces of a tee and calls anything else other", () => {
    expect(["front", "back", "sleeve", "collar", "pocket"].map(pieceRole)).toEqual(["front", "back", "sleeve", "collar", "other"]);
  });
});

describe("detectLandmarks", () => {
  const turn = (id: string): Point[] => [...Object.values(piece(id).landmarks)] as Point[];

  it("names a torso's turn points in the order the file lists them", () => {
    const front = piece("front");
    const ordered = ["cf-hem", "side-hem", "underarm", "shoulder-point", "hps", "cf-neck"].map((n) => front.landmarks[n as keyof typeof front.landmarks]) as Point[];
    expect(detectLandmarks("front", front.cutOutline, [...ordered, ordered[0]])).toEqual({ landmarks: front.landmarks, problem: null });
  });

  it("finds a sleeve's four corners and its cap top", () => {
    const sleeve = piece("sleeve");
    const corners = [sleeve.landmarks["underarm-b"], sleeve.landmarks["underarm-a"], sleeve.landmarks["hem-a"], sleeve.landmarks["hem-b"]] as Point[];
    const result = detectLandmarks("sleeve", sleeve.cutOutline, corners);
    expect(result.landmarks).toEqual(sleeve.landmarks);
  });

  it("says nothing is wrong for a collar or a piece it does not know", () => {
    expect(detectLandmarks("collar", piece("collar").cutOutline, [])).toEqual({ landmarks: {}, problem: null });
    expect(detectLandmarks("pocket", piece("collar").cutOutline, [])).toEqual({ landmarks: {}, problem: null });
  });

  it("finds nothing, and says why, when the turn points are wrong", () => {
    const front = piece("front");
    expect(detectLandmarks("front", front.cutOutline, turn("front").slice(0, 3)).problem).toContain("should mark 6 turn points and marks 3");
    expect(detectLandmarks("front", front.cutOutline, [[1, 1]]).problem).toBe("A turn point is not on the outline.");
    const sleeve = piece("sleeve");
    expect(detectLandmarks("sleeve", sleeve.cutOutline, [sleeve.landmarks["hem-a"] as Point]).problem).toContain("four turn points");
  });

  it("cannot find a cap top on a sleeve that has none", () => {
    const flat: Point[] = [[0, 0], [0, 10], [-5, 10], [-5, 0]];
    expect(detectLandmarks("sleeve", flat, flat).problem).toBe("The top of the sleeve cap could not be found.");
  });
});

describe("distinctPoints", () => {
  it("lists each place once", () => {
    expect(distinctPoints([[0, 0], [1, 1], [0, 0.01], [2, 2]])).toEqual([[0, 0], [1, 1], [2, 2]]);
  });
});

describe("overrides", () => {
  it("replace found landmarks one at a time", () => {
    expect(withOverrides({ hps: [1, 1], underarm: [2, 2] }, { hps: [9, 9] })).toEqual({ hps: [9, 9], underarm: [2, 2] });
    expect(withOverrides({ hps: [1, 1] }, undefined)).toEqual({ hps: [1, 1] });
  });

  it("are cleaned to known names and rounded", () => {
    expect(cleanOverrides({ hps: [1.234, 5], nonsense: [0, 0] })).toEqual({ hps: [1.23, 5] });
  });
});

describe("missingLandmarks", () => {
  it("lists what a piece of its role lacks", () => {
    expect(missingLandmarks({ id: "front", landmarks: { hps: [0, 0] } })).toEqual(["cf-hem", "side-hem", "underarm", "shoulder-point", "cf-neck"]);
    expect(missingLandmarks({ id: "collar", landmarks: {} })).toEqual([]);
    expect(missingLandmarks(piece("sleeve"))).toEqual([]);
  });
});
