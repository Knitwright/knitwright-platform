import { describe, expect, it } from "vitest";
import { classifyColour, iccProfileName } from "./icc";

const u32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

/** A profile with one `desc` tag holding the given tag body. */
const profile = (tag: number[], name = "desc") => {
  const header = new Array(128).fill(0);
  const table = [...u32(1), ...ascii(name), ...u32(128 + 4 + 12), ...u32(tag.length)];
  return Uint8Array.from([...header, ...table, ...tag]);
};

const v2 = (text: string) => [...ascii("desc"), 0, 0, 0, 0, ...u32(text.length + 1), ...ascii(text), 0];
const v4 = (text: string) => {
  const units = [...text].flatMap((c) => [0, c.charCodeAt(0)]);
  return [...ascii("mluc"), 0, 0, 0, 0, ...u32(1), ...u32(12), ...ascii("enUS"), ...u32(units.length), ...u32(28), ...units];
};

describe("iccProfileName", () => {
  it("reads a version 2 description and a version 4 one", () => {
    expect(iccProfileName(profile(v2("Adobe RGB (1998)")))).toBe("Adobe RGB (1998)");
    expect(iccProfileName(profile(v4("Display P3")))).toBe("Display P3");
  });

  it("gives null for no profile, a short one, no description tag, an unknown tag type or text outside the file", () => {
    expect(iccProfileName(undefined)).toBeNull();
    expect(iccProfileName(new Uint8Array(10))).toBeNull();
    expect(iccProfileName(profile(v2("x"), "wtpt"))).toBeNull();
    expect(iccProfileName(profile([...ascii("xxxx"), 0, 0, 0, 0, 0, 0, 0, 0]))).toBeNull();
    expect(iccProfileName(profile([...ascii("desc"), 0, 0, 0, 0, ...u32(9999), 65]))).toBeNull();
    expect(iccProfileName(profile([...ascii("mluc"), 0, 0, 0, 0, ...u32(1), ...u32(12), ...ascii("enUS"), ...u32(9999), ...u32(28)]))).toBeNull();
    expect(iccProfileName(profile([...ascii("desc"), 0, 0, 0, 0, ...u32(0)]))).toBeNull();
    const cut = profile(v2("Name"));
    expect(iccProfileName(cut.subarray(0, 134))).toBeNull();
  });
});

describe("classifyColour", () => {
  it("names where the colours came from", () => {
    expect(classifyColour("cmyk", "ISO Coated")).toBe("cmyk");
    expect(classifyColour("srgb", "Adobe RGB (1998)")).toBe("adobe-rgb");
    expect(classifyColour("srgb", "Display P3")).toBe("display-p3");
    expect(classifyColour("b-w", null)).toBe("grey");
    expect(classifyColour("grey16", null)).toBe("grey");
    expect(classifyColour("srgb", "Dot Gain 20% Gray")).toBe("grey");
    expect(classifyColour("srgb", null)).toBe("srgb");
    expect(classifyColour("rgb16", null)).toBe("srgb");
    expect(classifyColour("srgb", "sRGB IEC61966-2.1")).toBe("srgb");
    expect(classifyColour("srgb", "Apple RGB")).toBe("unknown");
    expect(classifyColour("lab", null)).toBe("unknown");
  });
});
