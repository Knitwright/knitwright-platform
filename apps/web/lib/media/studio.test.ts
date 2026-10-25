import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import type { ImageMap } from "@/lib/flat/images";
import { REFERENCE_EDGE, flatModels, renderReference } from "@/lib/images/reference";
import { DEFAULT_CHART_SET } from "@/lib/sizing";
import { protectedRegions } from "./regions";
import { FLAT_LAY, renderFlatLay, renderStudioSet } from "./studio";

const CREST_ID = "0b4a5b1e-7c7e-4e57-9d6a-3f1a2b3c4d5e";

const crest = (id: string, anchor: string, size: number, panelId = "body-front") => ({
  id,
  name: id,
  source: { kind: "file", fileId: CREST_ID },
  panelId,
  anchor,
  offsetX: 0,
  offsetY: 0,
  width: size,
  height: size,
  rotationDegrees: 0,
  technique: "screen-print",
  provenance: "user-edited",
});

const design = (): GarmentSpec =>
  ({
    ...start("crew-tee"),
    artwork: [crest("crest", "centre-chest", 1200)],
    namesAndNumbers: {
      places: [{ place: "back-name", height: 600 }, { place: "back-number", height: 2000 }],
      colour: "",
      sampleName: "SMITH",
      sampleNumber: "7",
      provenance: "user-edited",
    },
  }) as unknown as GarmentSpec;

const pictures = async (): Promise<ImageMap> => {
  const bytes = await sharp({ create: { width: 60, height: 60, channels: 3, background: { r: 200, g: 20, b: 20 } } }).png().toBuffer();
  return new Map([[CREST_ID, { bytes: new Uint8Array(bytes), contentType: "image/png" as const }]]);
};

const models = () => {
  const found = flatModels(design(), DEFAULT_CHART_SET);
  if (!found) throw new Error("No drawing");
  return found;
};

const crop = async (png: Uint8Array, r: { x: number; y: number; width: number; height: number }) =>
  Buffer.from(await sharp(png).extract({ left: r.x, top: r.y, width: r.width, height: r.height }).raw().toBuffer());

describe("studio renders", () => {
  it("makes front, back and flat lay as PNGs with their sizes", async () => {
    const set = await renderStudioSet({ ...models(), images: await pictures() });
    expect(set.map((item) => item.view)).toEqual(["front", "back", "flat_lay"]);
    expect(set.every((item) => item.kind === "studio_render" && item.checker === "not_checked" && item.costMicrodollars === 0)).toBe(true);
    expect([set[0]?.width, set[0]?.height]).toEqual([REFERENCE_EDGE, REFERENCE_EDGE]);
    expect([set[2]?.width, set[2]?.height]).toEqual([FLAT_LAY.width, FLAT_LAY.height]);
  });

  it("gives identical bytes for the same version, run twice", async () => {
    const first = await renderStudioSet({ ...models(), images: await pictures() });
    const second = await renderStudioSet({ ...models(), images: await pictures() });
    first.forEach((item, i) => expect(Buffer.from(item.png).equals(Buffer.from(second[i]?.png ?? new Uint8Array()))).toBe(true));
  });

  it("puts the front flat on a neutral surface with a soft shadow", async () => {
    const flat = await renderFlatLay(models().front, await pictures());
    const { data, info } = await sharp(flat).raw().toBuffer({ resolveWithObject: true });
    const at = (x: number, y: number) => [data[(y * info.width + x) * info.channels], data[(y * info.width + x) * info.channels + 1], data[(y * info.width + x) * info.channels + 2]];
    expect(at(5, 5)).toEqual([0xe6, 0xe4, 0xe1]);
    // Just below the garment's lowest edge the surface is darker than the open corner: the shadow.
    const darker = Array.from({ length: info.height }, (_, y) => at(Math.round(info.width / 2), y)).filter((p) => (p[0] ?? 255) < 0xe6 - 3);
    expect(darker.length).toBeGreaterThan(50);
  });

  it("leaves the crest, name and number regions identical to the design's own render", async () => {
    const m = models();
    const images = await pictures();
    const own = await renderReference(m.back, images);
    const studio = (await renderStudioSet({ ...m, images }))[1]?.png ?? new Uint8Array();
    const front = await renderReference(m.front, images);
    const studioFront = (await renderStudioSet({ ...m, images }))[0]?.png ?? new Uint8Array();
    const backRegions = protectedRegions(m.back, REFERENCE_EDGE);
    const frontRegions = protectedRegions(m.front, REFERENCE_EDGE);
    expect(frontRegions.some((r) => r.label === "logo")).toBe(true);
    expect(backRegions.some((r) => r.label === "text")).toBe(true);
    for (const r of frontRegions) expect((await crop(studioFront, r)).equals(await crop(front, r))).toBe(true);
    for (const r of backRegions) expect((await crop(studio, r)).equals(await crop(own, r))).toBe(true);
  });
});
