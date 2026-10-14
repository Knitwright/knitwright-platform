import { describe, expect, it } from "vitest";
import { readPdf } from "@/lib/flat/fixtures/pdf-read";
import { uploadArtwork } from "@/lib/artwork-intake/service";
import { SVG_REFUSALS } from "@/lib/artwork-intake/messages";
import type { FillItem } from "../scene";
import { growRing, intersectRings } from "../geometry/clip";
import { areaOf, boundsOf } from "../geometry/polygon";
import { BRAND, USER, NOW, realWorld, specOf } from "../fixtures/real";
import { polkaStack } from "../fixtures/stacks";

/**
 * Plan W3, acceptance case 3, for real: an SVG goes through W7b's intake (cleaned, stored as plain vector data, never
 * as SVG), is read back by the reader, and is printed at the left chest 90 mm wide.
 */
const LOGO = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 60" width="100mm" height="60mm">
  <path d="M0 0H100V60H0Z" fill="#c8102e"/>
  <circle cx="50" cy="30" r="22" fill="#ffffff" stroke="#1b2a49" stroke-width="3"/>
  <path d="M30 30 Q50 5 70 30 T30 30Z" fill="#1b2a49"/>
</svg>`;

const layer = (assetId: string, extra: Record<string, unknown> = {}) => ({
  opacity: 1, blend: "normal", provenance: "user-edited", id: "logo", kind: "graphic", views: ["front"], source: { kind: "asset", assetId },
  placement: { kind: "anchor", anchorId: "left-chest" }, offsetMm: { x: 0, y: 0 }, widthMm: 90, rotationDeg: 0, clearSpaceMm: 10, knockOut: true, ...extra,
});

describe("case 3: a user's vector logo, read through the real intake and reader", () => {
  it("is 90 mm wide within 0.1 mm in every size, and the dots are knocked out of its clear space", async () => {
    const world = await realWorld();
    const id = await world.upload(new TextEncoder().encode(LOGO), "Club logo.svg");
    const builder = world.builder(polkaStack([layer(id)]));
    for (const size of world.pattern.sizes) {
      const { scene } = (await builder.buildFile(specOf("front", size, "svg"))).scene;
      const fills = scene.items.filter((i): i is FillItem => i.kind === "fill" && i.layerId === "logo");
      expect(fills.length, size).toBeGreaterThan(0);
      const box = boundsOf(fills.flatMap((i) => i.rings.flat()));
      // The pattern file lies turned on the page, so the long side is the logo's width, whichever way it runs.
      const [short, long] = [box.maxX - box.minX, box.maxY - box.minY].sort((a, b) => a - b);
      expect(Math.abs(long! - 90), `${size} width`).toBeLessThan(0.1);
      expect(Math.abs(short! - 54), `${size} height`).toBeLessThan(0.1);
      const logo = boundsOf(fills[0]!.rings.flat());
      const clear = growRing([[logo.minX, logo.minY], [logo.maxX, logo.minY], [logo.maxX, logo.maxY], [logo.minX, logo.maxY]], 10, "miter");
      const dots = scene.items.filter((i): i is FillItem => i.kind === "fill" && i.layerId === "dots");
      const inside = dots.flatMap((d) => intersectRings(d.rings, [clear])).reduce((sum, ring) => sum + areaOf(ring), 0);
      expect(inside, `${size} dots in clear space`).toBeLessThan(0.5);
    }
  }, 120_000);

  it("is still vector in the PDF: path operators, no picture", async () => {
    const world = await realWorld();
    const id = await world.upload(new TextEncoder().encode(LOGO), "Club logo.svg");
    const builder = world.builder(polkaStack([layer(id)]));
    const pdf = await readPdf((await builder.buildFile(specOf("front", "M", "pdf"))).bytes);
    const names = pdf.operations.map((o) => o.name);
    expect(names).toContain("constructPath");
    expect(names.filter((n) => /paintImage|paintInlineImage|paintJpeg|paintImageMask/.test(n))).toEqual([]);
    const svg = new TextDecoder().decode((await builder.buildFile(specOf("front", "M", "svg"))).bytes);
    expect(svg).not.toContain("<image");
  }, 120_000);

  it("keeps no SVG anywhere, and refuses an SVG with a script before it can reach a print file", async () => {
    const world = await realWorld();
    await world.upload(new TextEncoder().encode(LOGO), "Club logo.svg");
    for (const file of world.fake.tables.files) {
      expect(String(file.content_type)).not.toContain("svg");
      expect(String(file.path)).not.toMatch(/\.svg$/);
    }
    for (const bytes of world.fake.objects.values()) expect(Buffer.from(bytes).includes(Buffer.from("<svg"))).toBe(false);
    const evil = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><script>alert(1)</script><rect width="10" height="10"/></svg>';
    await expect(uploadArtwork(world.fake.admin, { brandId: BRAND, userId: USER }, { bytes: new TextEncoder().encode(evil), fileName: "x.svg", rightsConfirmed: true, now: NOW })).rejects.toMatchObject({ message: SVG_REFUSALS.script });
  }, 60_000);

  it("leaves another brand's logo off with a sentence, as if it were not there", async () => {
    const world = await realWorld();
    const id = await world.upload(new TextEncoder().encode(LOGO), "Club logo.svg");
    const { createAssetReader } = await import("@/lib/artwork-intake");
    const other = createAssetReader(world.fake.admin, "33333333-3333-4333-8333-333333333333");
    const { scene } = (await world.builder(polkaStack([layer(id)]), { assets: other }).buildFile(specOf("front", "M", "svg"))).scene;
    expect(scene.issues.some((i) => i.severity === "stop" && /not available/.test(i.text))).toBe(true);
    expect(scene.items.some((i) => i.layerId === "logo")).toBe(false);
  }, 60_000);
});
