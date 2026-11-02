import { describe, expect, it } from "vitest";
import { VIDEO_GAP_RULE } from "./formats";
import {
  COLOURWAY_LABELS,
  isSequenceKey,
  SEQUENCES,
  SEQUENCE_KEYS,
  sequenceVerdict,
  VIDEO_SEQUENCES,
  videoSequence,
  type ViewCapability,
} from "./sequences";

describe("the deterministic sequences", () => {
  it("are the four the spec names, at the lengths the spec gives", () => {
    expect(SEQUENCE_KEYS).toEqual(["turntable", "flip", "kit_reveal", "carousel"]);
    expect(VIDEO_SEQUENCES.turntable.seconds).toBe(6);
    expect(VIDEO_SEQUENCES.flip.seconds).toBe(4);
    expect(VIDEO_SEQUENCES.kit_reveal.seconds).toBe(8);
    expect(VIDEO_SEQUENCES.carousel.seconds).toBe(9);
  });

  it("have shots that add up to the length each one claims", () => {
    for (const sequence of SEQUENCES) {
      const total = sequence.shots.reduce((sum, shot) => sum + shot.seconds, 0);
      expect(total, sequence.key).toBe(sequence.seconds);
    }
  });

  it("give every sequence a rule id, a note and words for the person", () => {
    for (const sequence of SEQUENCES) {
      expect(sequence.ruleId).toBe(VIDEO_GAP_RULE);
      expect(sequence.note).toMatch(/spec/i);
      expect(sequence.label.length).toBeGreaterThan(3);
      expect(sequence.lead).toMatch(/\w/);
      expect(sequence.needs.length).toBeGreaterThan(0);
    }
  });

  it("give every shot its own words, so waiting can say which part is being recorded", () => {
    for (const sequence of SEQUENCES) {
      for (const shot of sequence.shots) {
        expect(shot.label, `${sequence.key}/${shot.id}`).toMatch(/\w/);
        expect(shot.seconds).toBeGreaterThan(0);
      }
      expect(new Set(sequence.shots.map((shot) => shot.id)).size).toBe(sequence.shots.length);
    }
  });

  it("turn the garment all the way round for the turntable and half way for the flip", () => {
    expect(VIDEO_SEQUENCES.turntable.shots[0]?.camera).toEqual({ kind: "orbit", fromDegrees: 0, toDegrees: 360 });
    expect(VIDEO_SEQUENCES.flip.shots[0]?.camera).toEqual({ kind: "orbit", fromDegrees: 0, toDegrees: 180 });
  });

  it("reveal the kit as fabric, then shirt, then crest", () => {
    expect(VIDEO_SEQUENCES.kit_reveal.shots.map((shot) => shot.subject)).toEqual(["fabric", "garment", "crest"]);
  });

  it("show the three kits of the carousel, three seconds each", () => {
    expect(VIDEO_SEQUENCES.carousel.shots.map((shot) => shot.colourway)).toEqual(["home", "away", "gk"]);
    expect(VIDEO_SEQUENCES.carousel.shots.every((shot) => shot.seconds === 3)).toBe(true);
    expect(COLOURWAY_LABELS.gk).toBe("Goalkeeper");
  });

  it("reads a key, and gives nothing back for one it does not know", () => {
    expect(isSequenceKey("flip")).toBe(true);
    expect(isSequenceKey("spin")).toBe(false);
    expect(videoSequence("carousel")?.seconds).toBe(9);
    expect(videoSequence("spin")).toBeNull();
    expect(videoSequence(7)).toBeNull();
  });
});

describe("whether a 3D view can record a sequence", () => {
  const all: readonly ViewCapability[] = ["turn", "camera", "colourway"];

  it("offers a sequence to a view that can do everything it needs", () => {
    for (const sequence of SEQUENCES) expect(sequenceVerdict(sequence, all), sequence.key).toEqual({ offered: true });
  });

  it("offers the turntable to a view that can only turn, and refuses the rest in words", () => {
    expect(sequenceVerdict(VIDEO_SEQUENCES.turntable, ["turn"]).offered).toBe(true);
    const flip = sequenceVerdict(VIDEO_SEQUENCES.flip, ["turn"]);
    expect(flip.offered).toBe(false);
    if (flip.offered) return;
    expect(flip.missing).toEqual(["camera"]);
    expect(flip.reason).toContain("point the camera");
    expect(flip.reason).toContain("Front-to-back flip");
    expect(flip.ruleId).toBe(VIDEO_GAP_RULE);
  });

  it("names every missing ability in one sentence", () => {
    const made = { ...VIDEO_SEQUENCES.carousel, needs: ["camera", "colourway"] as const };
    const answer = sequenceVerdict(made, []);
    expect(answer.offered).toBe(false);
    if (answer.offered) return;
    expect(answer.reason).toContain("point the camera and change the colour version");
  });

  it("refuses every sequence for a view with nothing at all", () => {
    for (const sequence of SEQUENCES) expect(sequenceVerdict(sequence, []).offered, sequence.key).toBe(false);
  });
});
