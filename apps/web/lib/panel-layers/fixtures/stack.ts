import { parseArtworkStack, type ArtworkStack } from "@/lib/artwork-stack";

/** A made-up front-view stack with one layer of every kind. A test shape, not a club's design. */
const raw = {
  schemaVersion: 1,
  views: ["front", "back"],
  colours: [
    { id: "navy", role: "body", screen: "#1b2a49", codes: [], provenance: "user-edited" },
    { id: "gold", role: "pattern", screen: "#d4af37", codes: [], provenance: "user-edited" },
    { id: "white", role: "marks", screen: "#ffffff", codes: [], provenance: "user-edited" },
  ],
  layers: [
    { id: "ground-front", kind: "ground", views: ["front"], opacity: 1, blend: "normal", provenance: "user-edited", colourId: "navy" },
    {
      id: "hoops",
      kind: "pattern",
      views: ["front", "back"],
      opacity: 0.8,
      blend: "normal",
      provenance: "user-edited",
      generatorId: "kit-hoops",
      params: { size: 40 },
      datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } },
      colourIds: ["gold"],
    },
    {
      id: "photo",
      kind: "image-fill",
      views: ["front"],
      opacity: 0.5,
      blend: "multiply",
      provenance: "user-edited",
      assetId: "asset-1",
      mode: "tile",
      scale: 1.5,
      rotationDeg: 15,
      offsetMm: { x: 3, y: -4 },
      halfDrop: true,
      fit: "cover",
    },
    {
      id: "crest",
      name: "Club crest",
      kind: "graphic",
      views: ["front"],
      opacity: 1,
      blend: "normal",
      technique: "sublimation",
      provenance: "user-edited",
      source: { kind: "asset", assetId: "asset-2" },
      placement: { kind: "anchor", anchorId: "left-chest", panelId: "body-front" },
      offsetMm: { x: 60, y: -80 },
      widthMm: 90,
      heightMm: 100,
      rotationDeg: 12.5,
      clearSpaceMm: 5,
      knockOut: false,
    },
    {
      id: "sponsor",
      kind: "text",
      views: ["front"],
      opacity: 1,
      blend: "normal",
      provenance: "user-edited",
      text: "ACME BUILDERS",
      placement: { kind: "zone", zoneId: "chest" },
      offsetMm: { x: 0, y: 40 },
      heightMm: 30,
      rotationDeg: 0,
      colourId: "white",
    },
    {
      id: "mark-back-number",
      kind: "player-mark",
      views: ["back"],
      opacity: 1,
      blend: "normal",
      provenance: "user-edited",
      place: "back-number",
      colourId: "white",
      sample: { name: "RIVERA", number: "9" },
    },
  ],
  colourways: [{ id: "home", name: "Home", colours: {} }],
};

const parsed = parseArtworkStack(raw);
if (!parsed.ok) throw new Error(`The panel layers fixture is not a valid stack: ${parsed.reason}`);
export const FIXTURE_STACK: ArtworkStack = parsed.stack;

/** A 500 x 700 mm test panel centred on the origin. A test shape, not a pattern. */
export const FIXTURE_PANEL = {
  id: "front",
  cutOutline: [[-250, -350], [250, -350], [250, 350], [-250, 350]] as [number, number][],
  sewLine: [[-240, -340], [240, -340], [240, 340], [-240, 340]] as [number, number][],
  mirrorLines: [] as [[number, number], [number, number]][],
};
