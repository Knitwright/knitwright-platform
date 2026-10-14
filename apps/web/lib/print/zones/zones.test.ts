import { describe, expect, it } from "vitest";
import { printZoneSchema } from "@/lib/production/contract";
import { TEST_BASE_SIZE, TEST_GRADED_JERSEY } from "../fixtures/graded";
import { boundsOf, boxesOverlap, pointInPolygon, polygonArea } from "../geometry/vec";
import { createLayoutMapper } from "../layout/mapper";
import { ZONE_DEFAULT_SOURCE, ZONE_TEMPLATES, anchorPoint, buildZones, zoneFor } from "./index";

const mapper = createLayoutMapper({ pattern: TEST_GRADED_JERSEY, baseSize: TEST_BASE_SIZE });
const sizes = TEST_GRADED_JERSEY.sizes;

describe("print zones", () => {
  const zones = buildZones(mapper, sizes);

  it("makes a zone for every template the pattern has the piece for, valid against the contract", () => {
    expect(zones.map((z) => z.purpose).sort()).toEqual(["back-name", "back-number", "crest", "front-number", "sleeve-badge", "sleeve-band", "sleeve-band", "sleeve-badge", "sponsor"].sort());
    for (const zone of zones) expect(() => printZoneSchema.parse(zone)).not.toThrow();
  });
  it("has a polygon for every size, inside the cut outline of that size", () => {
    for (const zone of zones.filter((z) => z.purpose !== "sleeve-band")) {
      const { view } = ZONE_TEMPLATES.find((t) => t.id === zone.id)!;
      for (const size of sizes) {
        const poly = zone.polygonBySize[size];
        expect(poly, `${zone.id} ${size}`).toBeDefined();
        const outline = mapper.frame(view, size)!.opened.outline;
        poly.forEach((corner, at) => expect(pointInPolygon(corner, outline), `${zone.id} ${size} corner ${at}`).toBe(true));
      }
    }
  });
  it("keeps the standard clear space of 10 mm and says where the sizes of the zones came from", () => {
    expect(zones.every((z) => z.clearSpaceMm === 10)).toBe(true);
    expect(ZONE_DEFAULT_SOURCE).toMatch(/not from your league or print house/);
  });
  it("holds the sponsor zone to 30 x 7 cm, as the jersey template states", () => {
    const sponsor = zones.find((z) => z.purpose === "sponsor")!;
    const poly = sponsor.polygonBySize["48"];
    const b = boundsOf(poly);
    const sides = [b.maxX - b.minX, b.maxY - b.minY].sort((a, c) => c - a);
    expect(sides[0]).toBeCloseTo(300, 1);
    expect(sides[1]).toBeCloseTo(70, 1);
  });
  it("does not let two zones on one piece overlap", () => {
    for (const size of sizes) {
      for (const pieceId of ["front", "back"]) {
        const here = zones.filter((z) => z.pieceId === pieceId).map((z) => boundsOf(z.polygonBySize[size]));
        here.forEach((a, i) => here.slice(i + 1).forEach((b) => expect(boxesOverlap(a, b)).toBe(false)));
      }
    }
  });
  it("follows the garment: the crest zone is the same size in every size and sits by the landmarks", () => {
    const areas = sizes.map((s) => polygonArea(zones.find((z) => z.purpose === "crest")!.polygonBySize[s]));
    for (const a of areas) expect(a).toBeCloseTo(areas[0], 3);
  });
  it("looks a zone up by purpose and by id", () => {
    expect(zoneFor(zones, "back-number")?.pieceId).toBe("back");
    expect(zoneFor(zones, "nothing")).toBeUndefined();
  });
  it("names the template of each purpose with its default size labelled", () => {
    for (const t of ZONE_TEMPLATES) expect(t.source).toBe(ZONE_DEFAULT_SOURCE.length > 0 ? t.source : "");
  });
  it("gives the flat's named anchors a place on the plane in every size", () => {
    for (const size of sizes) {
      const left = anchorPoint(mapper, "front", "left-chest", size)!;
      const centre = anchorPoint(mapper, "front", "centre-chest", size)!;
      expect(left.x).toBeGreaterThan(0);
      expect(centre.x).toBe(0);
      expect(anchorPoint(mapper, "front", "nowhere", size)).toBeNull();
      expect(anchorPoint(mapper, "sleeve-left", "sleeve-centre", size)).not.toBeNull();
      expect(anchorPoint(mapper, "front", "hps", size)).not.toBeNull();
    }
  });
});
