import { describe, expect, it } from "vitest";
import { PREVIEW_LABEL, cameraFor, motionFor, textureSize, zoomLimits } from "./viewer";

const size = { width: 0.9, height: 0.72, depth: 0.2 };

describe("the words beside the 3D view", () => {
  it("say plainly that it shows shape and colour, not fit or drape", () => {
    expect(PREVIEW_LABEL).toBe("A preview of shape and colour, not of fit or drape.");
  });
});

describe("motionFor", () => {
  it("turns the garment slowly and eases between views when motion is welcome", () => {
    expect(motionFor(false)).toEqual({ autoRotate: true, easeSeconds: 0.6 });
  });

  it("keeps it still and jumps between views when the person asked for less motion", () => {
    expect(motionFor(true)).toEqual({ autoRotate: false, easeSeconds: 0 });
  });
});

describe("cameraFor", () => {
  it("looks at the front from in front, and at the back from behind", () => {
    const front = cameraFor("front", size, 35, 1);
    const back = cameraFor("back", size, 35, 1);
    expect(front[2]).toBeGreaterThan(0);
    expect(back[2]).toBeLessThan(0);
    expect(front[0]).toBe(0);
    expect(Math.abs(back[2])).toBeCloseTo(front[2], 9);
  });

  it("stands far enough back for the whole garment to fit, in a narrow frame too", () => {
    const wide = cameraFor("front", size, 35, 1.5)[2];
    const narrow = cameraFor("front", size, 35, 0.6)[2];
    const halfHeightSeen = (distance: number) => Math.tan(((35 / 2) * Math.PI) / 180) * (distance - size.depth / 2);
    expect(halfHeightSeen(wide)).toBeGreaterThanOrEqual(size.height / 2);
    expect(halfHeightSeen(narrow) * 0.6).toBeGreaterThanOrEqual(size.width / 2);
    expect(narrow).toBeGreaterThan(wide);
  });
});

describe("zoomLimits", () => {
  it("lets a person come closer and go further, but never inside the garment or out of sight", () => {
    const { min, max } = zoomLimits(size);
    expect(min).toBeGreaterThan(size.depth);
    expect(max).toBeGreaterThan(min * 3);
  });
});

describe("textureSize", () => {
  it("keeps the flat's shape and gives the longer side the size asked for", () => {
    expect(textureSize({ minX: -5000, minY: -300, maxX: 5000, maxY: 7700 }, 2048)).toEqual({ width: 2048, height: 1638 });
    expect(textureSize({ minX: 0, minY: 0, maxX: 100, maxY: 200 }, 1024)).toEqual({ width: 512, height: 1024 });
  });
});
