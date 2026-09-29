import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import { fullDesign, packFor } from "../../fixtures/designs";
import { allText } from "../fixtures/pdf-pages";
import { noSpace, readPdfOf } from "../fixtures/pdf-helpers";
import { PICTURE_LEFT_OUT } from "../limits";

const FILE = "6f0b1c1e-6a3b-4f6e-9f43-0f5f3a1a2b11";

const withPicture = (): GarmentSpec => {
  const result = applyAction(fullDesign("crew-tee"), {
    type: "add-artwork",
    artwork: { id: "logo", name: "Logo", source: { kind: "file", fileId: FILE }, panelId: "body-front", anchor: "centre-chest", offsetX: 0, offsetY: 0, width: 600, height: 300, rotationDegrees: 0, technique: "screen-print", provenance: "user-edited" },
  });
  if (!result.ok) throw new Error(result.reason);
  return result.spec;
};

describe("pictures in the PDF", () => {
  it("draws a picture as a picture, and says nothing about one left out when none was", async () => {
    const png = await sharp({ create: { width: 40, height: 20, channels: 3, background: "#22aa44" } }).png().toBuffer();
    const images = new Map([[FILE, { bytes: new Uint8Array(png), contentType: "image/png" as const }]]);
    const { pages } = await readPdfOf(packFor(withPicture()), images, { operations: true });
    expect(pages.flatMap((page) => page.operations)).toContain("paintImageXObject");
    expect(noSpace(allText(pages))).not.toContain(noSpace(PICTURE_LEFT_OUT));
  });

  it("says in words that a picture was left out, and draws the dashed box in its place", async () => {
    const { pages } = await readPdfOf(packFor(withPicture()), new Map(), { pictureLeftOut: true, operations: true });
    expect(noSpace(allText(pages))).toContain(noSpace(PICTURE_LEFT_OUT));
    expect(pages.flatMap((page) => page.operations)).not.toContain("paintImageXObject");
  });
});

describe("a garment type with no drawing", () => {
  it("gives its sentence and no drawing", async () => {
    const { pages } = await readPdfOf(packFor({ ...start("crew-tee"), typeId: "kilt" }));
    expect(allText(pages)).toContain("There is no drawing for this garment type yet.");
  });
});
