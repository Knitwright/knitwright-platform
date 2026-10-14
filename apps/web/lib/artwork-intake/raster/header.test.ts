import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { cmykTiff } from "../fixtures/cmyk-tiff";
import { pngHeaderClaiming, solidPng } from "../fixtures/pictures";
import { claimedSize } from "./header";

describe("claimedSize", () => {
  it("reads PNG, JPEG and TIFF headers without decoding", async () => {
    expect(claimedSize(pngHeaderClaiming(100_000, 70_000), "png")).toEqual({ width: 100_000, height: 70_000 });
    const jpeg = await sharp({ create: { width: 33, height: 21, channels: 3, background: "#fff" } }).jpeg().toBuffer();
    expect(claimedSize(jpeg, "jpeg")).toEqual({ width: 33, height: 21 });
    expect(claimedSize(cmykTiff({ width: 12, height: 7, pixel: [0, 0, 0, 0] }), "tiff")).toEqual({ width: 12, height: 7 });
    const tiff = await sharp(await solidPng(9, 5, "#fff")).tiff().toBuffer();
    expect(claimedSize(tiff, "tiff")).toEqual({ width: 9, height: 5 });
  });

  it("reads a progressive JPEG with comment segments before the frame", async () => {
    const jpeg = await sharp({ create: { width: 20, height: 10, channels: 3, background: "#fff" } }).jpeg({ progressive: true }).toBuffer();
    expect(claimedSize(jpeg, "jpeg")).toEqual({ width: 20, height: 10 });
  });

  it("gives null for headers that are cut short or wrong", () => {
    expect(claimedSize(Uint8Array.from([0x89, 0x50]), "png")).toBeNull();
    expect(claimedSize(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0, 4, 0, 0]), "jpeg")).toBeNull();
    expect(claimedSize(Uint8Array.from([0xff, 0xd8, 0x00, 0x00, 0, 0, 0, 0, 0, 0]), "jpeg")).toBeNull();
    expect(claimedSize(Uint8Array.from([0x49, 0x49, 0x2a, 0x00, 0xff, 0xff, 0, 0]), "tiff")).toBeNull();
    expect(claimedSize(Uint8Array.from([0x49, 0x49]), "tiff")).toBeNull();
  });
});
