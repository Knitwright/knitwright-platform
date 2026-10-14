import { parseArtworkStack, type ArtworkStack } from "@/lib/artwork-stack";

const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
const BODY = ["front", "back", "sleeve-left", "sleeve-right"] as const;

const colour = (id: string, role: string, screen: string) => ({ id, role, screen, codes: [], provenance: "user-edited" });

/** The benchmark polka-dot jersey: white ground, 30 mm dots 70 mm apart in two colours, half drop, names and numbers in navy. */
export function polkaStack(extra: readonly unknown[] = [], overrides: Partial<Record<string, unknown>> = {}): ArtworkStack {
  const result = parseArtworkStack({
    schemaVersion: 1,
    views: ["front", "back", "sleeve-left", "sleeve-right", "collar"],
    colours: [colour("white", "base", "#ffffff"), colour("red", "dot row A", "#cc2222"), colour("blue", "dot row B", "#2255aa"), colour("navy", "numbers", "#1b2a49")],
    colourways: [{ id: "main", name: "Home", colours: {} }],
    layers: [
      { ...common, id: "ground", kind: "ground", views: ["front", "back", "sleeve-left", "sleeve-right", "collar"], colourId: "white" },
      {
        ...common,
        id: "dots",
        kind: "pattern",
        views: BODY,
        generatorId: "kit-dots",
        params: { dotWidthMm: 30, pitchMm: 70, rowStepMm: 35, halfDrop: true, clearSpaceMm: 10 },
        datum: { anchor: "chest-line", offsetMm: { x: 0, y: 0 } },
        colourIds: ["red", "blue"],
      },
      { ...common, id: "back-name", kind: "player-mark", views: ["back"], place: "back-name", heightMm: 60, colourId: "navy" },
      { ...common, id: "back-number", kind: "player-mark", views: ["back"], place: "back-number", heightMm: 250, colourId: "navy" },
      { ...common, id: "front-number", kind: "player-mark", views: ["front"], place: "front-number", heightMm: 100, colourId: "navy" },
      ...extra,
    ],
    ...overrides,
  });
  if (!result.ok) throw new Error(result.reason);
  return result.stack;
}
