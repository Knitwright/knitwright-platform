import { describe, expect, it } from "vitest";
import { SWATCH_PATTERN } from "@/lib/garment";
import { COLOUR_NAMES, readSwatch, swatchForName } from "./colour-names";

describe("the drawn colour for a colour name", () => {
  it("knows the usual sports kit colours", () => {
    for (const name of ["royal blue", "navy", "sky blue", "red", "maroon", "gold", "yellow", "green", "bottle green", "black", "white", "orange", "purple", "grey", "silver", "pink", "teal", "claret"]) {
      expect(swatchForName(name), name).toMatch(SWATCH_PATTERN);
    }
  });

  it("reads a name however it is written", () => {
    expect(swatchForName("Royal Blue")).toBe(swatchForName("royal blue"));
    expect(swatchForName("  royal-blue ")).toBe(swatchForName("royal blue"));
    expect(swatchForName("navy blue")).toBe(swatchForName("navy"));
    expect(swatchForName("gray")).toBe(swatchForName("grey"));
    expect(swatchForName("royal")).toBe(swatchForName("royal blue"));
  });

  it("gives white and black their own colours, so names drawn on them stay readable", () => {
    expect(swatchForName("white")).toBe("#ffffff");
    expect(swatchForName("black")).toBe("#111111");
  });

  it("knows nothing of a name it has no colour for, such as a factory code", () => {
    expect(swatchForName("Pantone 286 C")).toBeUndefined();
    expect(swatchForName("")).toBeUndefined();
  });

  it("has a drawn colour for every name in the table", () => {
    for (const swatch of Object.values(COLOUR_NAMES)) expect(swatch).toMatch(SWATCH_PATTERN);
  });
});

describe("a colour written as a code", () => {
  it("reads #rrggbb and rrggbb, in lower case", () => {
    expect(readSwatch("#1B2A49")).toBe("#1b2a49");
    expect(readSwatch("1b2a49")).toBe("#1b2a49");
    expect(readSwatch(" #fff000 ")).toBe("#fff000");
  });

  it("is not a colour name", () => {
    expect(readSwatch("navy")).toBeNull();
    expect(readSwatch("#12")).toBeNull();
    expect(readSwatch("")).toBeNull();
  });
});
