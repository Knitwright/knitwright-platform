import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { colourSpaceOf, readProfile } from "./icc";

const profileOf = async (name: "srgb"): Promise<Uint8Array | undefined> => {
  const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } })
    .tiff()
    .withIccProfile(name)
    .toBuffer();
  return (await sharp(bytes).metadata()).icc;
};

describe("readProfile", () => {
  it("names the built-in sRGB profile and its space", async () => {
    const facts = readProfile(await profileOf("srgb"));
    expect(facts?.space).toBe("rgb");
    expect(facts?.name).toMatch(/srgb/i);
  });

  it("reads a CMYK profile", async () => {
    const bytes = await sharp({ create: { width: 2, height: 2, channels: 3, background: "red" } })
      .toColourspace("cmyk")
      .tiff()
      .withIccProfile("cmyk")
      .toBuffer();
    const facts = readProfile((await sharp(bytes).metadata()).icc);
    expect(facts?.space).toBe("cmyk");
    expect(facts?.name).toBe("Chemical proof");
  });

  it("returns null for nothing, for too little, and for bytes that are not a profile", () => {
    expect(readProfile(undefined)).toBeNull();
    expect(readProfile(new Uint8Array(10))).toBeNull();
    expect(readProfile(new Uint8Array(400))).toBeNull();
  });

  it("copes with a profile whose tag table is cut short or has no description", () => {
    const bytes = new Uint8Array(140);
    new TextEncoder().encodeInto("acsp", bytes.subarray(36));
    new TextEncoder().encodeInto("RGB ", bytes.subarray(16));
    new DataView(bytes.buffer).setUint32(128, 5);
    expect(readProfile(bytes)).toEqual({ name: null, space: "rgb" });
  });

  it("reads a legacy description and a v4 multi-localised one from hand-made profiles", () => {
    const make = (type: "desc" | "mluc", space: string): Uint8Array => {
      const bytes = new Uint8Array(400);
      const view = new DataView(bytes.buffer);
      const put = (at: number, text: string) => new TextEncoder().encodeInto(text, bytes.subarray(at));
      put(36, "acsp");
      put(16, space);
      view.setUint32(128, 1);
      put(132, "desc");
      view.setUint32(136, 200);
      view.setUint32(140, 100);
      put(200, type);
      if (type === "desc") {
        view.setUint32(208, 6);
        put(212, "Adobe\0");
      } else {
        view.setUint32(208, 1);
        view.setUint32(212, 12);
        view.setUint32(220, 24);
        view.setUint32(224, 28);
        const name = "Display P3";
        for (let i = 0; i < name.length; i += 1) view.setUint16(200 + 28 + i * 2, name.charCodeAt(i));
        view.setUint32(220, name.length * 2);
      }
      return bytes;
    };
    expect(readProfile(make("desc", "RGB "))).toEqual({ name: "Adobe", space: "rgb" });
    expect(readProfile(make("mluc", "RGB "))).toEqual({ name: "Display P3", space: "rgb" });
    expect(readProfile(make("desc", "Lab "))?.space).toBe("other");
  });
});

describe("colourSpaceOf", () => {
  it("names the space a picture came from", () => {
    expect(colourSpaceOf(null, "srgb")).toBe("unknown");
    expect(colourSpaceOf(null, "cmyk")).toBe("cmyk");
    expect(colourSpaceOf(null, "b-w")).toBe("grey");
    expect(colourSpaceOf({ name: "Adobe RGB (1998)", space: "rgb" }, "srgb")).toBe("adobe-rgb");
    expect(colourSpaceOf({ name: "Display P3", space: "rgb" }, "srgb")).toBe("display-p3");
    expect(colourSpaceOf({ name: "sRGB IEC61966-2.1", space: "rgb" }, "srgb")).toBe("srgb");
    expect(colourSpaceOf({ name: null, space: "grey" }, "b-w")).toBe("grey");
    expect(colourSpaceOf({ name: "x", space: "cmyk" }, "srgb")).toBe("cmyk");
  });
});
