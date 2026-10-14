import { describe, expect, it } from "vitest";
import { createFakePieceMapper } from "@/lib/artwork-stack";
import { applyTransform } from "./geometry";
import { fitView, outlineToDesign, placeOnPieces } from "./fit";
import { findLandmarks } from "./landmarks";
import { findOutline, type Outline } from "./outline";
import { starterTemplate, type TemplateSource } from "./template";
import { teePicture } from "./fixtures/synthetic";

const NAVY = [27, 42, 73] as const;
const outline = findOutline(teePicture({ garment: NAVY })).value as Outline;
const landmarks = findLandmarks(outline).value;
const front = starterTemplate.templateFor("front", "M")!;

describe("fitView", () => {
  it("fits the picture's landmarks to the template and puts the neck near the centre line", () => {
    const fit = fitView({ view: "front", landmarks, template: front, kind: "flat" });
    expect(fit.value).not.toBeNull();
    expect(fit.confidence).toBeGreaterThan(0.45);
    const neck = landmarks.find((l) => l.id === "cf-neck")!;
    const at = applyTransform(fit.value!.transform, neck.at);
    expect(Math.abs(at.x)).toBeLessThan(15);
    expect(fit.value!.used).toBeGreaterThanOrEqual(9);
  });

  it("uses cb names on the back and mirrors the left side", () => {
    const back = starterTemplate.templateFor("back", "M")!;
    const fit = fitView({ view: "back", landmarks, template: back, kind: "flat" });
    expect(fit.value).not.toBeNull();
    const left = landmarks.find((l) => l.id === "hps" && l.side === "left")!;
    expect(applyTransform(fit.value!.transform, left.at).x).toBeLessThan(0);
  });

  it("uses a perspective map for a photo, and says it is approximate", () => {
    const fit = fitView({ view: "front", landmarks, template: front, kind: "photo" });
    expect(fit.value?.transform.kind).toBe("homography");
    expect(fit.note).toMatch(/photo/i);
    expect(fit.note).toMatch(/approximate/i);
  });

  it("falls back to a flat map when a photo has too few landmarks for a perspective map", () => {
    const few = landmarks.filter((l) => ["hps", "cf-hem"].includes(l.id) && l.side !== "left").concat(landmarks.filter((l) => l.id === "cf-neck"));
    const fit = fitView({ view: "front", landmarks: few, template: front, kind: "photo" });
    expect(fit.value?.transform.kind).toBe("affine");
  });

  it("gives nothing, and says why, with too few landmarks", () => {
    const fit = fitView({ view: "front", landmarks: landmarks.slice(0, 2), template: front, kind: "flat" });
    expect(fit.value).toBeNull();
    expect(fit.confidence).toBe(0);
    expect(fit.note).toMatch(/landmark/i);
  });

  it("gives nothing when there is no template for the view", () => {
    const none: TemplateSource = { description: "none", templateFor: () => null };
    expect(none.templateFor("collar", "M")).toBeNull();
    const fit = fitView({ view: "collar", landmarks, template: null, kind: "flat" });
    expect(fit.value).toBeNull();
  });

  it("trusts a poor fit less", () => {
    const skewed = landmarks.map((l) => (l.id === "underarm" ? { ...l, at: { x: l.at.x + 150, y: l.at.y - 90 } } : l));
    const good = fitView({ view: "front", landmarks, template: front, kind: "flat" });
    const bad = fitView({ view: "front", landmarks: skewed, template: front, kind: "flat" });
    expect(bad.confidence).toBeLessThan(good.confidence);
  });
});

describe("placing the result", () => {
  const fit = fitView({ view: "front", landmarks, template: front, kind: "flat" }).value!;

  it("puts the outline in design space", () => {
    const points = outlineToDesign(fit, outline.polygon);
    expect(points).toHaveLength(outline.polygon.length);
    expect(Math.min(...points.map((p) => p.x))).toBeLessThan(-200);
    expect(Math.max(...points.map((p) => p.x))).toBeGreaterThan(200);
  });

  it("asks the piece mapper where each landmark lands for one size", () => {
    const hits = placeOnPieces(createFakePieceMapper(), fit, "M");
    expect(hits.length).toBe(fit.landmarks.length);
    expect(hits[0].hit?.pieceId).toBe("front");
  });

  it("keeps a landmark that falls on no piece, with no hit", () => {
    const hits = placeOnPieces({ toPiece: () => null }, fit, "M");
    expect(hits.every((h) => h.hit === null)).toBe(true);
  });
});
