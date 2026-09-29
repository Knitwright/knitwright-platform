import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { TOO_LARGE, type FileReader } from "@/lib/storage/read";
import { ILLUSTRATION_EDGE, loadIllustrations } from "./illustrations";

const big = () =>
  sharp({ create: { width: 1024, height: 1024, channels: 3, background: "#336699" } })
    .png()
    .toBuffer();

const readerOf = (files: Record<string, Uint8Array | typeof TOO_LARGE | null>): FileReader => ({
  read: async (id) => {
    const found = files[id];
    if (found === undefined || found === null) return null;
    return found === TOO_LARGE ? TOO_LARGE : { bytes: found, contentType: "image/png" };
  },
});

const LATEST = {
  version: 3,
  images: [
    { view: "front" as const, fileId: "f" },
    { view: "back" as const, fileId: "b" },
  ],
};

describe("loadIllustrations", () => {
  it("is null when no images were made", async () => {
    expect(await loadIllustrations(readerOf({}), null)).toBeNull();
  });

  it("gives each view a small picture for the page, labelled and described", async () => {
    const bytes = new Uint8Array(await big());
    const loaded = await loadIllustrations(readerOf({ f: bytes, b: bytes }), LATEST);

    expect(loaded?.version).toBe(3);
    expect(loaded?.illustrations.map((item) => item.label)).toEqual(["Front", "Back"]);
    expect(loaded?.illustrations[0].alt).toMatch(/illustration/i);
    const src = loaded?.illustrations[0].src ?? "";
    expect(src.startsWith("data:image/jpeg;base64,")).toBe(true);
    const meta = await sharp(Buffer.from(src.split(",")[1], "base64")).metadata();
    expect(meta.width).toBe(ILLUSTRATION_EDGE);
  });

  it("leaves out a picture that cannot be read or is too large", async () => {
    const bytes = new Uint8Array(await big());
    const loaded = await loadIllustrations(readerOf({ f: bytes, b: TOO_LARGE }), LATEST);

    expect(loaded?.illustrations.map((item) => item.label)).toEqual(["Front"]);
    expect(await loadIllustrations(readerOf({ f: new Uint8Array([1, 2]), b: null }), LATEST)).toBeNull();
  });
});
