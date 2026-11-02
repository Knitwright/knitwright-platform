import { describe, expect, it } from "vitest";
import {
  PIN_PLACES,
  isPinPlaceId,
  pinStyle,
  pinSummary,
  placeOfPoint,
  pointOfPlace,
  pointOfPress,
  type PointBounds,
} from "./points";

const BOUNDS: PointBounds = { widthMm: 600, heightMm: 900 };

describe("the nine named places", () => {
  it("covers every third across and down exactly once", () => {
    expect(PIN_PLACES).toHaveLength(9);
    const pairs = PIN_PLACES.map((place) => `${place.across}-${place.down}`);
    expect(new Set(pairs).size).toBe(9);
  });

  it("recognises its own ids and nothing else", () => {
    expect(isPinPlaceId("middle-centre")).toBe(true);
    expect(isPinPlaceId("elbow")).toBe(false);
    expect(isPinPlaceId(7)).toBe(false);
  });

  it("puts a place in the middle of its own third", () => {
    expect(pointOfPlace(PIN_PLACES[0], BOUNDS)).toEqual({ xMm: 100, yMm: 150 });
    expect(pointOfPlace(PIN_PLACES[4], BOUNDS)).toEqual({ xMm: 300, yMm: 450 });
    expect(pointOfPlace(PIN_PLACES[8], BOUNDS)).toEqual({ xMm: 500, yMm: 750 });
  });

  it("gives back the place every point of that place falls in", () => {
    for (const place of PIN_PLACES) {
      expect(placeOfPoint(pointOfPlace(place, BOUNDS), BOUNDS).id).toBe(place.id);
    }
  });
});

describe("a press on the drawing", () => {
  it("reads the press as a share of the picture's own box, whatever its size on screen", () => {
    expect(pointOfPress({ x: 0.5, y: 0.5 }, BOUNDS)).toEqual({ xMm: 300, yMm: 450 });
    expect(pointOfPress({ x: 0, y: 0 }, BOUNDS)).toEqual({ xMm: 0, yMm: 0 });
    expect(pointOfPress({ x: 1, y: 1 }, BOUNDS)).toEqual({ xMm: 600, yMm: 900 });
  });

  it("keeps a press outside the picture inside it, so a pin is never off the panel", () => {
    expect(pointOfPress({ x: -0.4, y: 1.8 }, BOUNDS)).toEqual({ xMm: 0, yMm: 900 });
  });

  it("is kept to a tenth of a millimetre, which is what the column holds", () => {
    expect(pointOfPress({ x: 1 / 3, y: 1 / 7 }, BOUNDS).xMm).toBe(200);
    expect(pointOfPress({ x: 0.123456, y: 0 }, BOUNDS).xMm).toBe(74.1);
  });

  it("agrees with the named places, so the radio buttons follow a press", () => {
    const point = pointOfPress({ x: 0.9, y: 0.1 }, BOUNDS);
    expect(placeOfPoint(point, BOUNDS).id).toBe("top-right");
  });
});

describe("a drawing with no size", () => {
  it("puts the pin in the middle rather than dividing by nought", () => {
    const none: PointBounds = { widthMm: 0, heightMm: 0 };
    expect(placeOfPoint({ xMm: 0, yMm: 0 }, none).id).toBe("middle-centre");
    expect(pinStyle({ xMm: 0, yMm: 0 }, none)).toEqual({ left: "50%", top: "50%" });
  });
});

describe("where a pin is drawn", () => {
  it("is a share of the picture, so it lands in the same place at any size", () => {
    expect(pinStyle({ xMm: 300, yMm: 450 }, BOUNDS)).toEqual({ left: "50%", top: "50%" });
    expect(pinStyle({ xMm: 600, yMm: 900 }, BOUNDS)).toEqual({ left: "100%", top: "100%" });
  });

  it("never leaves the picture, even for a point outside it", () => {
    expect(pinStyle({ xMm: 5000, yMm: 5000 }, BOUNDS)).toEqual({ left: "100%", top: "100%" });
  });
});

describe("pinSummary", () => {
  it("says who, where on the kit and whereabouts", () => {
    expect(pinSummary("Sam", "Body front", "Top left")).toBe("Sam, on the body front, top left");
  });
});
