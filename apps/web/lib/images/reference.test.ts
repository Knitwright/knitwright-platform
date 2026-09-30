import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { DEFAULT_CHART_SET, withBrandCharts } from "@/lib/sizing";
import { madeUpChart } from "@/lib/sizing/fixtures/made-up-charts";
import type { ImageMap } from "@/lib/flat/images";
import { REFERENCE_EDGE, flatModels, renderReference } from "./reference";

const LOGO_ID = "0b4a5b1e-7c7e-4e57-9d6a-3f1a2b3c4d5e";

const withLogo = (): GarmentSpec =>
  ({
    ...start("crew-tee"),
    artwork: [
      {
        id: "logo",
        name: "Logo",
        source: { kind: "file", fileId: LOGO_ID },
        panelId: "body-front",
        anchor: "centre-chest",
        offsetX: 0,
        offsetY: 0,
        width: 2000,
        height: 2000,
        rotationDegrees: 0,
        technique: "screen-print",
        provenance: "user-edited",
      },
    ],
  }) as GarmentSpec;

const redSquare = async (): Promise<ImageMap> => {
  const bytes = await sharp({
    create: { width: 40, height: 40, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  return new Map([[LOGO_ID, { bytes: new Uint8Array(bytes), contentType: "image/png" as const }]]);
};

const countRed = async (png: Uint8Array): Promise<number> => {
  const { data, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
  let red = 0;
  for (let index = 0; index < data.length; index += info.channels) {
    if (data[index] > 200 && data[index + 1] < 60 && data[index + 2] < 60) red += 1;
  }
  return red;
};

describe("flatModels", () => {
  it("draws a front and a back for a type that has a drawing", () => {
    const models = flatModels(start("crew-tee"), DEFAULT_CHART_SET);

    expect(models?.front.view).toBe("front");
    expect(models?.back.view).toBe("back");
  });

  it("leaves the measurement callouts out, so the model is not asked to draw numbers", () => {
    const models = flatModels(start("crew-tee"), DEFAULT_CHART_SET);
    const measurements = models?.front.layers.find((layer) => layer.id === "measurements");

    expect(measurements?.elements ?? []).toEqual([]);
  });

  it("draws the design with the brand's own chart when the brand has one, as the editor does", () => {
    const brandCharts = withBrandCharts(DEFAULT_CHART_SET, [
      {
        run: { id: "brand-women-crew-tee-any", wearer: "women", sizes: ["U1", "U2", "U3", "U4"] },
        chart: { ...madeUpChart("crew-tee", "women"), sizeRunId: "brand-women-crew-tee-any", supplier: "brand" },
      },
    ]);
    const platform = flatModels(start("crew-tee"), DEFAULT_CHART_SET);
    const brand = flatModels(start("crew-tee"), brandCharts);

    expect(JSON.stringify(brand?.front)).not.toBe(JSON.stringify(platform?.front));
  });

  it("is null for a type there is no drawing for", () => {
    expect(flatModels({ ...start("crew-tee"), typeId: "no-such-type" } as GarmentSpec, DEFAULT_CHART_SET)).toBeNull();
  });
});

describe("renderReference", () => {
  it("is a square PNG of the reference size on white", async () => {
    const models = flatModels(start("crew-tee"), DEFAULT_CHART_SET);
    const png = await renderReference(models!.front);
    const meta = await sharp(png).metadata();

    expect(meta.format).toBe("png");
    expect([meta.width, meta.height]).toEqual([REFERENCE_EDGE, REFERENCE_EDGE]);
    expect(meta.hasAlpha).toBe(false);
  });

  it("composites the uploaded logo's own pixels into the front", async () => {
    const images = await redSquare();
    const models = flatModels(withLogo(), DEFAULT_CHART_SET);

    expect(await countRed(await renderReference(models!.front, images))).toBeGreaterThan(10_000);
    // Without the file's bytes the logo is a dashed box, never a made-up picture.
    expect(await countRed(await renderReference(models!.front))).toBe(0);
  });
});
