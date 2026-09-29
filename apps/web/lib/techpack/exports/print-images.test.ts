import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { shrinkForDrawing } from "@/lib/storage/thumbnail";
import { PRINT_EDGE } from "./limits";
import { shrinkForPrint } from "./print-images";

const picture = (width: number, height: number, type: "png" | "jpeg") =>
  sharp({ create: { width, height, channels: 3, background: "#3366cc" } })[type]().toBuffer();

const sizeOf = async (bytes: Uint8Array) => {
  const meta = await sharp(bytes).metadata();
  return { width: meta.width, height: meta.height, format: meta.format };
};

describe("pictures made for print", () => {
  it("shrinks the longest side to the print size and keeps the shape and the type", async () => {
    const wide = await shrinkForPrint({ bytes: new Uint8Array(await picture(3200, 1600, "png")), contentType: "image/png" });
    expect(wide?.contentType).toBe("image/png");
    expect(await sizeOf(wide?.bytes ?? new Uint8Array())).toEqual({ width: PRINT_EDGE, height: 800, format: "png" });

    const tall = await shrinkForPrint({ bytes: new Uint8Array(await picture(2000, 4000, "jpeg")), contentType: "image/jpeg" });
    expect(tall?.contentType).toBe("image/jpeg");
    expect(await sizeOf(tall?.bytes ?? new Uint8Array())).toEqual({ width: 800, height: PRINT_EDGE, format: "jpeg" });
  });

  it("is larger than the screen size, which is 320", async () => {
    const bytes = new Uint8Array(await picture(3000, 3000, "png"));
    const print = await shrinkForPrint({ bytes, contentType: "image/png" });
    const screen = await shrinkForDrawing({ bytes, contentType: "image/png" });
    expect((await sizeOf(print?.bytes ?? new Uint8Array())).width).toBe(1600);
    expect((await sizeOf(screen?.bytes ?? new Uint8Array())).width).toBe(320);
  });

  it("never makes a picture larger", async () => {
    const small = await shrinkForPrint({ bytes: new Uint8Array(await picture(300, 200, "png")), contentType: "image/png" });
    expect(await sizeOf(small?.bytes ?? new Uint8Array())).toEqual({ width: 300, height: 200, format: "png" });
  });

  it("gives nothing for bytes that are not a picture, and for a picture with too many pixels", async () => {
    expect(await shrinkForPrint({ bytes: new Uint8Array([1, 2, 3, 4]), contentType: "image/png" })).toBeNull();
    const big = new Uint8Array(await picture(400, 400, "png"));
    expect(await shrinkForPrint({ bytes: big, contentType: "image/png" }, 100)).toBeNull();
  });
});
