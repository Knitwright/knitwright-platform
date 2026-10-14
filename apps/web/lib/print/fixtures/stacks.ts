import { ARTWORK_STACK_VERSION, DEFAULT_DATUM, type ArtworkStack, type Layer, type StackColour, type ViewId } from "@/lib/artwork-stack";

const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;

export const colour = (id: string, screen: string): StackColour => ({ id, role: id, screen, codes: [], provenance: "user-edited" });

export const GROUND = colour("ground-colour", "#ffffff");
export const RED = colour("red", "#cc1f2d");
export const BLUE = colour("blue", "#1f3fa8");
export const NAVY = colour("navy", "#101c40");
export const GREEN_A = colour("green-a", "#3b5d2a");
export const GREEN_B = colour("green-b", "#6f8f3d");
export const GREEN_C = colour("green-c", "#2a3a1c");

const BODY: readonly ViewId[] = ["front", "back"];

export function stackOf(layers: readonly Layer[], colours: readonly StackColour[], views: readonly ViewId[] = ["front", "back", "sleeve-left", "sleeve-right", "collar"]): ArtworkStack {
  return {
    schemaVersion: ARTWORK_STACK_VERSION,
    views,
    colours: [GROUND, ...colours],
    layers: [{ ...common, kind: "ground", id: "ground", views, colourId: GROUND.id }, ...layers],
    colourways: [{ id: "home", name: "Home", colours: {} }],
  };
}

export const playerMarks = (colourId = NAVY.id): Layer[] => [
  { ...common, kind: "player-mark", id: "mark-back-name", views: ["back"], place: "back-name", heightMm: 30, colourId, sample: { name: "RIVERA", number: "9" } },
  { ...common, kind: "player-mark", id: "mark-back-number", views: ["back"], place: "back-number", heightMm: 250, colourId, sample: { name: "RIVERA", number: "9" } },
  { ...common, kind: "player-mark", id: "mark-front-number", views: ["front"], place: "front-number", heightMm: 100, colourId, sample: { name: "RIVERA", number: "9" } },
];

/** Case 2: a user's full-panel picture on the front and back. */
export const panelStack = (assetId: string, scale = 1): ArtworkStack =>
  stackOf(
    [{ ...common, kind: "image-fill", id: "panel-art", views: BODY, assetId, mode: "panel", scale, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, fit: "cover" }],
    [],
    BODY,
  );

/** Case 3: dots, a vector logo at the left chest with its clear space knocked out of the pattern. */
export const logoStack = (assetId: string): ArtworkStack =>
  stackOf(
    [
      { ...common, kind: "pattern", id: "dots", views: BODY, generatorId: "kit-dots", params: { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true }, datum: DEFAULT_DATUM, colourIds: [RED.id, BLUE.id] },
      {
        ...common,
        kind: "graphic",
        id: "crest",
        name: "Club crest",
        views: ["front"],
        source: { kind: "asset", assetId },
        placement: { kind: "anchor", anchorId: "left-chest" },
        offsetMm: { x: 0, y: 0 },
        widthMm: 90,
        rotationDeg: 0,
        clearSpaceMm: 10,
        knockOut: true,
      },
    ],
    [RED, BLUE],
    BODY,
  );

/** Case 4: a generated camo field, seeded. */
export const camoStack = (seed: number): ArtworkStack =>
  stackOf(
    [{ ...common, kind: "pattern", id: "camo", views: ["front", "back", "sleeve-left", "sleeve-right"], generatorId: "test-camo", params: { blobMm: 60 }, seed, datum: DEFAULT_DATUM, colourIds: [GREEN_A.id, GREEN_B.id, GREEN_C.id] }],
    [GREEN_A, GREEN_B, GREEN_C],
  );

/** Case 8: a multiply layer on the back only. */
export const blendStack = (): ArtworkStack =>
  stackOf(
    [
      { ...common, kind: "pattern", id: "dots-front", views: ["front"], generatorId: "kit-dots", params: { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true }, datum: DEFAULT_DATUM, colourIds: [RED.id, BLUE.id] },
      { ...common, kind: "pattern", id: "dots-back", views: ["back"], generatorId: "kit-dots", params: { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true }, datum: DEFAULT_DATUM, colourIds: [RED.id, BLUE.id], blend: "multiply" },
    ],
    [RED, BLUE],
    BODY,
  );

/** Case 7: the benchmark dots with a name (30 mm), a back number and a front number from the roster. */
export const rosterStack = (): ArtworkStack =>
  stackOf(
    [
      { ...common, kind: "pattern", id: "dots", views: BODY, generatorId: "kit-dots", params: { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true, clearSpaceMm: 10 }, datum: DEFAULT_DATUM, colourIds: [RED.id, BLUE.id] },
      ...playerMarks(),
    ],
    [RED, BLUE, NAVY],
    BODY,
  );
