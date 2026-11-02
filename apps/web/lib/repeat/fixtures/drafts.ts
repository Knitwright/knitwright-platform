import { BLANK_DRAFT, type RepeatDraft, type RepeatLayer } from "../types";

/** Repeats to test with: a 10 cm tile with one picture in the middle of it. */

export const ARTWORK_ID = "3f2d7a26-1c4e-4a7b-9f55-0b7e6a1c2d34";

export const layer = (over: Partial<RepeatLayer> = {}): RepeatLayer => ({
  id: "l1",
  label: "Club stripe",
  artworkId: ARTWORK_ID,
  shape: null,
  colour: "#1b2a49",
  xTenths: 500,
  yTenths: 500,
  widthTenths: 500,
  heightTenths: 500,
  rotationDeg: 0,
  sourcePx: { width: 1200, height: 1200 },
  ...over,
});

export const draft = (over: Partial<RepeatDraft> = {}): RepeatDraft => ({
  ...BLANK_DRAFT,
  name: "Club hoops",
  layers: [layer()],
  ...over,
});
