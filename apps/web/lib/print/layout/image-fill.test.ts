import { describe, expect, it } from "vitest";
import { type ArtworkStack, type Layer } from "@/lib/artwork-stack";
import { offsetOutline } from "@/lib/production/geometry/offset";
import { squareLogo, testCard, vectorLogo } from "../fixtures/assets";
import { makeEnv } from "../fixtures/env";
import { RED, stackOf } from "../fixtures/stacks";
import { MAX_TILES, planImageFill } from "./image-fill";
import { createPrintSpace, NO_SCALE } from "./print-space";

const common = { opacity: 1, blend: "normal", provenance: "user-edited" } as const;
const fill = (over: Record<string, unknown>): Extract<Layer, { kind: "image-fill" }> =>
  ({ ...common, kind: "image-fill", id: "art", views: ["front"], assetId: "tile", mode: "tile", scale: 1, rotationDeg: 0, offsetMm: { x: 0, y: 0 }, halfDrop: false, fit: "cover", ...over }) as never;

async function plan(layer: Extract<Layer, { kind: "image-fill" }>, assets: Parameters<typeof makeEnv>[1]) {
  const stack: ArtworkStack = stackOf([layer], [RED], ["front"]);
  const env = await makeEnv(stack, assets);
  const space = createPrintSpace(env.mapper, "front", "48", NO_SCALE)!;
  return planImageFill({ env, layer, view: "front", size: "48", space, bleedOutline: offsetOutline(space.outline, 15) });
}

describe("picture fill", () => {
  it("repeats a tile over the piece on a shared datum, one picture reused", async () => {
    const tile = await squareLogo("tile", 300, 100);
    const result = await plan(fill({}), { assets: [tile] });
    expect(result.set!.tiles).toHaveLength(1);
    // 300 px at 100 dpi is 76 mm: the front, about 750 x 520 mm with bleed, takes dozens of repeats.
    expect(result.set!.instances.length).toBeGreaterThan(50);
    expect(result.lowestDpi).toBeCloseTo(100, 6);
    expect(result.issues.map((i) => i.code)).toEqual(["below-min-dpi"]);
  });
  it("drops every other column by half a tile with half drop, and turns the lattice with the rotation", async () => {
    const tile = await squareLogo("tile", 600, 100);
    const [plain, dropped, turned] = await Promise.all([
      plan(fill({}), { assets: [tile] }),
      plan(fill({ halfDrop: true }), { assets: [tile] }),
      plan(fill({ rotationDeg: 30 }), { assets: [tile] }),
    ]);
    const origins = (r: typeof plain) => new Set(r.set!.instances.map((i) => `${i.origin[0].toFixed(3)}|${i.origin[1].toFixed(3)}`));
    expect(origins(dropped)).not.toEqual(origins(plain));
    expect(turned.set!.instances[0].ex[0] !== plain.set!.instances[0].ex[0] || turned.set!.instances[0].ex[1] !== plain.set!.instances[0].ex[1]).toBe(true);
  });
  it("says how large a repeat is when it is too small to repeat sensibly, and leaves it out", async () => {
    const tile = await squareLogo("tile", 20, 300);
    const result = await plan(fill({ scale: 0.05 }), { assets: [tile] });
    expect(result.set).toBeNull();
    expect(result.issues[0].text).toContain(`more than ${MAX_TILES} times`);
  });
  it("fits one picture to the panel: cover fills the box, contain keeps it all in view", async () => {
    const card = await testCard(600, 800);
    const [cover, contain] = await Promise.all([plan(fill({ mode: "panel", assetId: "card", fit: "cover" }), { assets: [card] }), plan(fill({ mode: "panel", assetId: "card", fit: "contain" }), { assets: [card] })]);
    expect(cover.set!.instances).toHaveLength(1);
    const size = (r: typeof cover) => r.set!.tiles[0].widthPx * r.set!.tiles[0].heightPx;
    expect(size(cover)).toBeGreaterThanOrEqual(size(contain));
    expect(cover.notes.some((n) => /states no resolution/.test(n))).toBe(true);
  });
  it("recolours a single-colour picture when asked", async () => {
    const tile = await squareLogo("tile", 100, 300);
    const plain = await plan(fill({}), { assets: [tile] });
    const tinted = await plan(fill({ recolourIds: ["red"] }), { assets: [tile] });
    expect(Buffer.from(tinted.set!.tiles[0].png).equals(Buffer.from(plain.set!.tiles[0].png))).toBe(false);
  });
  it("leaves out a picture that is missing or a vector, saying so", async () => {
    const missing = await plan(fill({}), { assets: [] });
    expect(missing.issues[0].code).toBe("asset-missing");
    const vector = await plan(fill({ assetId: "logo" }), { assets: [vectorLogo("logo")] });
    expect(vector.issues[0].text).toMatch(/is a vector/);
    expect(vector.set).toBeNull();
  });
});
