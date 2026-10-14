import { describe, expect, it } from "vitest";
import type { PictureReading } from "./read";
import { nameViews } from "./views";

const reading = (views: PictureReading["views"]): PictureReading => ({ kind: "flat", garmentType: null, views, marks: [], colourGuesses: [], guesses: [], flaggedText: 0 });
const box = (x: number, w = 0.4) => ({ x, y: 0.05, w, h: 0.9 });
const px = (x: number, w = 400) => ({ x, y: 50, w, h: 900 });

describe("nameViews", () => {
  it("names each found region after the nearest view the model listed", () => {
    const result = nameViews({ width: 1000, height: 1000 }, [px(50), px(550)], reading([{ view: "back", box: box(0.55) }, { view: "front", box: box(0.05) }]));
    expect(result.views.map((v) => v.view)).toEqual(["front", "back"]);
    expect(result.views[0].confidence).toBeGreaterThan(0.7);
  });

  it("assumes a single region is the front when the model listed none, and says so", () => {
    const result = nameViews({ width: 1000, height: 1000 }, [px(300)], reading([]));
    expect(result.views.map((v) => v.view)).toEqual(["front"]);
    expect(result.views[0].confidence).toBeLessThan(0.5);
    expect(result.note).toMatch(/assumed/i);
  });

  it("assumes front then back for two regions with no names", () => {
    expect(nameViews({ width: 1000, height: 1000 }, [px(50), px(550)], reading([])).views.map((v) => v.view)).toEqual(["front", "back"]);
  });

  it("uses the model's boxes when the views touch and the picture holds fewer regions than views", () => {
    const result = nameViews({ width: 1000, height: 1000 }, [px(50, 900)], reading([{ view: "front", box: box(0.05) }, { view: "back", box: box(0.55) }]));
    expect(result.views.map((v) => v.view)).toEqual(["front", "back"]);
    expect(result.views[1].box.x).toBeCloseTo(550);
    expect(result.note).toMatch(/touch/i);
  });

  it("leaves out regions beyond the views it could name, and a view listed twice", () => {
    const result = nameViews({ width: 1000, height: 1000 }, [px(0, 200), px(300, 200), px(600, 200)], reading([{ view: "front", box: box(0) }, { view: "front", box: box(0.3) }]));
    expect(result.views).toHaveLength(1);
    expect(result.note).toMatch(/not used/i);
  });

  it("returns nothing for no regions", () => {
    expect(nameViews({ width: 10, height: 10 }, [], reading([])).views).toEqual([]);
  });
});
