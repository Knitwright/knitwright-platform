import { describe, expect, it } from "vitest";
import {
  ARTBOARD_UNITS,
  artboardUnit,
  aspectOf,
  DEFAULT_DPI,
  DPI_CHOICES,
  fromPixels,
  matchingPreset,
  MAX_ARTBOARD_PX,
  MIN_ARTBOARD_PX,
  presetSize,
  printSize,
  readSize,
  toPixels,
  UNIT_LABELS,
  writeLength,
  type ArtboardPreset,
} from "./index";

const preset = (over: Partial<ArtboardPreset> = {}): ArtboardPreset => ({
  key: "social-post-4-5",
  label: "Social post 4:5",
  width: 1080,
  height: 1350,
  unit: "px",
  dpi: 72,
  ruleId: "R-GAP-000",
  note: "Not reviewed by anyone",
  ...over,
});

describe("the three units of the artboard field", () => {
  it("is pixels, inches and millimetres, as the spec's Settings offers", () => {
    expect(ARTBOARD_UNITS).toEqual(["px", "in", "mm"]);
    expect(Object.values(UNIT_LABELS)).toEqual(["Pixels", "Inches", "Millimetres"]);
  });

  it("offers the spec's two resolutions and nothing it does not give", () => {
    expect(DPI_CHOICES).toEqual([72, 300]);
    expect(DEFAULT_DPI).toBe(72);
  });

  it("converts both ways without the size drifting", () => {
    expect(fromPixels(300, "in", 300)).toBe(1);
    expect(fromPixels(300, "mm", 300)).toBeCloseTo(25.4, 6);
    expect(fromPixels(1080, "px")).toBe(1080);
    expect(toPixels(1, "in", 300)).toBe(300);
    expect(toPixels(25.4, "mm", 300)).toBeCloseTo(300, 6);
    expect(toPixels(1080, "px")).toBe(1080);
  });

  it("writes pixels whole, inches to two places and millimetres to one", () => {
    expect(writeLength(1080, "px")).toBe("1080");
    expect(writeLength(1080, "in")).toBe("15.00");
    expect(writeLength(1080, "mm")).toBe("381.0");
  });

  it("writes the live print size the export panel shows", () => {
    expect(printSize({ width: 1200, height: 1200 }, "in", 72)).toBe("16.67 in × 16.67 in");
  });

  it("reads a stored or addressed unit, and treats anything unknown as pixels", () => {
    expect(artboardUnit("mm")).toBe("mm");
    expect(artboardUnit("cm")).toBe("px");
    expect(artboardUnit(undefined)).toBe("px");
  });
});

describe("a typed width and height", () => {
  it("becomes a size in pixels", () => {
    expect(readSize(1080, 1350, "px")).toEqual({ ok: true, size: { width: 1080, height: 1350 } });
    expect(readSize(210, 297, "mm", 300)).toEqual({ ok: true, size: { width: 2480, height: 3508 } });
  });

  it("is refused, never quietly changed, when it is not a size at all", () => {
    expect(readSize(Number.NaN, 100, "px")).toMatchObject({ ok: false, reason: "Give a width and a height." });
    expect(readSize(0, 100, "px")).toMatchObject({ ok: false, reason: "A width and a height are more than nothing." });
    expect(readSize(-5, 100, "px")).toMatchObject({ ok: false });
  });

  it("is refused outside the bounds, with the bound in the message and in the right unit", () => {
    expect(readSize(MIN_ARTBOARD_PX - 1, 100, "px")).toMatchObject({ ok: false, reason: "The smallest artboard is 16 px." });
    expect(readSize(MAX_ARTBOARD_PX + 1, 100, "px")).toMatchObject({ ok: false, reason: "The largest artboard is 20000 px." });
    expect(readSize(1, 1, "mm", 300)).toMatchObject({ ok: false, reason: "The smallest artboard is 1.4 mm." });
  });

  it("carries a rule id on every refusal, as every finding in the platform does", () => {
    const verdict = readSize(0, 0, "px");
    expect(verdict.ok === false && verdict.ruleId).toBe("R-GAP-000");
  });
});

describe("the presets beside the fields", () => {
  it("is read as a size in pixels, whatever unit the row is in", () => {
    expect(presetSize(preset())).toEqual({ width: 1080, height: 1350 });
    expect(presetSize(preset({ unit: "mm", dpi: 300, width: 210, height: 297 }))).toEqual({ width: 2480, height: 3508 });
  });

  it("marks the preset the artboard matches now, and nothing for a size of its own", () => {
    const presets = [preset(), preset({ key: "story", label: "Story 9:16", width: 1080, height: 1920 })];

    expect(matchingPreset({ width: 1080, height: 1920 }, presets)?.key).toBe("story");
    expect(matchingPreset({ width: 999, height: 999 }, presets)).toBeNull();
  });

  it("writes the aspect of a size in its simplest whole numbers", () => {
    expect(aspectOf({ width: 1080, height: 1350 })).toBe("4:5");
    expect(aspectOf({ width: 1080, height: 1920 })).toBe("9:16");
    expect(aspectOf({ width: 1080, height: 1080 })).toBe("1:1");
    expect(aspectOf({ width: 0, height: 0 })).toBe("0:0");
  });
});
