import { describe, expect, it } from "vitest";
import { fakeDeps } from "./test-deps";
import { printSummary } from "./summary";

describe("print summary", () => {
  it("gives the pieces, zones and settings the panel shows, with defaults labelled", async () => {
    const s = await printSummary(fakeDeps(), { query: {} });
    expect(s.design).toBe("Polka jersey");
    expect(s.sizes).toEqual(["48"]);
    expect(s.settings).toMatchObject({ bleedMm: 15, dpi: 150, minDpi: 150, label: "Knitwright default, not from your print house" });
    expect(s.scale).toBe("Not scaled for shrink: this fabric has no shrink test.");
    expect(s.rules).toMatch(/No league rules set/);
    expect(s.patternReviewed).toBe(false);
    expect(s.pieces.map((p) => p.view)).toEqual(["front", "back", "sleeve-left", "sleeve-right", "collar"]);
    const front = s.pieces.find((p) => p.view === "front")!;
    expect(front.outline.length).toBeGreaterThan(10);
    expect(front.zones.map((z) => z.purpose).sort()).toEqual(["crest", "front-number", "sponsor"]);
    expect(s.pieces.find((p) => p.view === "sleeve-left")!.zones.map((z) => z.id).sort()).toEqual(["sleeve-badge-left", "sleeve-band-left"]);
    expect(s.artwork).toMatch(/Dots/i);
    expect(s.colourways.length).toBeGreaterThan(0);
  });
});
