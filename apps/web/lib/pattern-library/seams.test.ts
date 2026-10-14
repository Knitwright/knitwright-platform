import { describe, expect, it } from "vitest";
import type { PatternPiece, Point } from "@/lib/production/contract";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { armholeLengths, landmarkIndices, seamsOf, workLine } from "./seams";

const base = JERSEY_EU48.piecesBySize["48"];
const get = (id: string): PatternPiece => base.find((p) => p.id === id) as PatternPiece;
const ids = (seams: ReturnType<typeof seamsOf>, piece: string) => seams.get(piece)?.map((s) => s.seamId);

describe("seamsOf", () => {
  const seams = seamsOf(base);

  it("names the front's six edges and the back's", () => {
    expect(ids(seams, "front")?.sort()).toEqual(["armhole-front", "fold", "hem", "neckline-front", "shoulder", "side-seam"]);
    expect(ids(seams, "back")?.sort()).toEqual(["armhole-back", "fold", "hem", "neckline-back", "shoulder", "side-seam"]);
  });

  it("matches the sleeve's cap halves to the front and back armholes by length", () => {
    expect(ids(seams, "sleeve")?.sort()).toEqual(["armhole-back", "armhole-front", "sleeve-hem", "sleeve-underarm", "sleeve-underarm"]);
    const front = seams.get("front")?.find((s) => s.seamId === "armhole-front")?.lengthMm as number;
    const sleeveFront = seams.get("sleeve")?.find((s) => s.seamId === "armhole-front")?.lengthMm as number;
    expect(Math.abs(front - sleeveFront)).toBeLessThan(2);
  });

  it("matches them the other way round when the sleeve is drawn the other way", () => {
    const sleeve = get("sleeve");
    const flipped: PatternPiece = { ...sleeve, landmarks: { ...sleeve.landmarks, "underarm-a": sleeve.landmarks["underarm-b"], "underarm-b": sleeve.landmarks["underarm-a"], "hem-a": sleeve.landmarks["hem-b"], "hem-b": sleeve.landmarks["hem-a"] } };
    const out = seamsOf(base.map((p) => (p.id === "sleeve" ? flipped : p)));
    const front = out.get("front")?.find((s) => s.seamId === "armhole-front")?.lengthMm as number;
    expect(Math.abs(front - (out.get("sleeve")?.find((s) => s.seamId === "armhole-front")?.lengthMm as number))).toBeLessThan(2);
  });

  it("gives the halves neutral names when the armholes are not known", () => {
    expect(ids(seamsOf([get("sleeve")]), "sleeve")?.sort()).toEqual(["sleeve-cap-a", "sleeve-cap-b", "sleeve-hem", "sleeve-underarm", "sleeve-underarm"]);
  });

  it("finds the collar's long edges, its fold and its join", () => {
    expect(ids(seams, "collar")?.sort()).toEqual(["collar-join", "collar-neckline", "collar-neckline", "fold"]);
  });

  it("gives no seams to a piece it does not know, a sleeve missing landmarks or a collar that is not a rectangle", () => {
    expect(ids(seamsOf([{ ...get("front"), id: "pocket" }]), "pocket")).toEqual([]);
    expect(ids(seamsOf([{ ...get("sleeve"), landmarks: {} }]), "sleeve")).toEqual([]);
    expect(ids(seamsOf([{ ...get("collar"), cutOutline: [[0, 0], [10, 0], [10, 10]] as Point[] }]), "collar")).toEqual([]);
  });

  it("finds a collar's seams without a fold line", () => {
    expect(ids(seamsOf([{ ...get("collar"), foldLine: null, onFold: false }]), "collar")?.sort()).toEqual(["collar-join", "collar-join", "collar-neckline", "collar-neckline"]);
  });

  it("makes no seams from a torso with a single landmark", () => {
    expect(ids(seamsOf([{ ...get("front"), landmarks: { hps: get("front").landmarks.hps } }]), "front")).toEqual([]);
  });
});

describe("armholeLengths and landmarkIndices", () => {
  it("measures both armholes, or says it cannot", () => {
    const lengths = armholeLengths(base);
    expect(lengths?.front).toBeCloseTo(234.4, 0);
    expect(lengths?.back).toBeCloseTo(246.0, 0);
    expect(armholeLengths([get("front")])).toBeNull();
    expect(armholeLengths([get("sleeve"), get("collar")])).toBeNull();
  });

  it("leaves out a landmark that is not on the line", () => {
    const front = get("front");
    const found = landmarkIndices(front.cutOutline, { ...front.landmarks, hps: [9999, 9999] });
    expect(found.has("hps")).toBe(false);
    expect(found.get("cf-hem")).toBe(0);
  });

  it("reads from the sew line when there is one", () => {
    expect(workLine({ cutOutline: [[0, 0]], sewLine: [[1, 1]] })).toEqual([[1, 1]]);
    expect(workLine({ cutOutline: [[0, 0]], sewLine: null })).toEqual([[0, 0]]);
  });
});
