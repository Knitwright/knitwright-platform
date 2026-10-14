import { describe, expect, it } from "vitest";
import { createPieceMapper } from "../layout/mapper";
import { gradedJersey } from "../fixtures/graded";
import { ringWithin } from "../geometry/polygon";
import { instancesOf } from "../frames/instances";
import { buildZones, findZone } from "./build";
import { JERSEY_ZONES, zoneTemplatesFor } from "./templates";

const pattern = gradedJersey();
const mapper = createPieceMapper(pattern);
const zones = buildZones(JERSEY_ZONES, pattern, mapper.anchors, { juniorSizes: new Set(["44"]) });

describe("zones", () => {
  it("builds every zone for every size, one id per sleeve", () => {
    expect(zones.map((z) => z.id).sort()).toEqual(
      ["back-name", "back-number", "crest", "front-number", "sleeve-badge-left", "sleeve-badge-right", "sleeve-band-left", "sleeve-band-right", "sponsor"].sort(),
    );
    for (const zone of zones) expect(Object.keys(zone.polygonBySize).sort()).toEqual([...pattern.sizes].sort());
  });

  it("keeps every zone inside its piece in every size", () => {
    for (const size of pattern.sizes) {
      const { instances } = instancesOf(pattern.piecesBySize[size]!, size);
      for (const zone of zones) {
        const piece = instances.find((i) => i.id === zone.pieceId)!;
        expect(ringWithin(zone.polygonBySize[size]!, piece.opened), `${zone.id} at ${size}`).toBe(true);
      }
    }
  });

  it("keeps the crest clear of the sponsor and the name clear of the number", () => {
    const box = (id: string) => zones.find((z) => z.id === id)!.polygonBySize["48"]!;
    const gap = (a: string, b: string) => {
      const [pa, pb] = [box(a), box(b)];
      const ys = (p: typeof pa) => p.map((q) => q[0]);
      return Math.max(Math.min(...ys(pa)) - Math.max(...ys(pb)), Math.min(...ys(pb)) - Math.max(...ys(pa)));
    };
    expect(gap("crest", "sponsor")).toBeGreaterThanOrEqual(10);
    expect(gap("back-name", "back-number")).toBeGreaterThanOrEqual(10);
  });

  it("makes marks smaller for junior sizes", () => {
    const width = (size: string) => {
      const p = zones.find((z) => z.id === "sponsor")!.polygonBySize[size]!;
      return Math.abs(p[0]![1] - p[1]![1]) + Math.abs(p[0]![0] - p[1]![0]);
    };
    expect(width("44")).toBeCloseTo(width("48") * 0.8, 1);
  });

  it("finds a zone by name, a sleeve zone by view, and says nothing for an unknown one", () => {
    expect(findZone(zones, "crest", "front")?.id).toBe("crest");
    expect(findZone(zones, "sleeve-badge", "sleeve-right")?.id).toBe("sleeve-badge-right");
    expect(findZone(zones, "sleeve-badge-left", "sleeve-left")?.id).toBe("sleeve-badge-left");
    expect(findZone(zones, "crest", "back")).toBeUndefined();
    expect(zoneTemplatesFor("football-jersey")).toBe(JERSEY_ZONES);
    expect(zoneTemplatesFor("socks")).toEqual([]);
  });
});

describe("mapper", () => {
  it("maps a design point on the front to the piece, and null off the garment", () => {
    const hit = mapper.toPiece("front", { x: 0, y: -50 }, "48");
    expect(hit?.pieceId).toBe("front");
    expect(mapper.toPiece("front", { x: 900, y: 0 }, "48")).toBeNull();
    expect(mapper.toPiece("front", { x: 0, y: 0 }, "99")).toBeNull();
  });

  it("lands the same design point at the same height above the chest line in every size", () => {
    const hits = pattern.sizes.map((s) => mapper.toPiece("front", { x: 60, y: -60 }, s)!);
    expect(hits.every((h) => h !== null)).toBe(true);
    // Rigid fit: distance from the underarm landmark does not change with size.
    const dist = pattern.sizes.map((s, i) => {
      const u = pattern.piecesBySize[s]!.find((p) => p.id === "front")!.landmarks.underarm!;
      return hits[i]!.xMm - u[0]; // along the body, from the chest line
    });
    for (const d of dist) expect(d).toBeCloseTo(dist[0]!, 0);
  });
});
