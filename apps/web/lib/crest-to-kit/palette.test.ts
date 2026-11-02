import { describe, expect, it } from "vitest";
import { toLab } from "@/lib/colour/convert";
import { extractPalette } from "@/lib/colour/palette";
import { isInsideApproxGamut } from "@/lib/guardrails/gamut";
import { CLUB_PALETTE } from "@/lib/kit-styles/presets";
import { deltaE2000 } from "@/lib/media-check/ciede2000";
import { crestPixels } from "./fixtures/crests";
import {
  crestColours,
  DELTA_BASIS,
  dominantOf,
  GAMUT_NOTE,
  KNITWRIGHT_NAMED_COLOURS,
  nearestReference,
  PANTONE_GAP,
  pickedColours,
  primaryDrift,
} from "./palette";
import { CREST_LIMITS, RULES } from "./settings";

const flat = (hex: string): ReturnType<typeof crestPixels> => {
  const data = new Uint8Array(4 * 4 * 4);
  for (let at = 0; at < 16; at += 1) {
    data[at * 4] = Number.parseInt(hex.slice(1, 3), 16);
    data[at * 4 + 1] = Number.parseInt(hex.slice(3, 5), 16);
    data[at * 4 + 2] = Number.parseInt(hex.slice(5, 7), 16);
    data[at * 4 + 3] = 255;
  }
  return { width: 4, height: 4, data };
};

describe("the palette of a crest", () => {
  it("is the shared extraction, read at the number of colours this screen asks for", () => {
    const pixels = crestPixels(2);
    expect(crestColours(pixels).map((one) => one.hex)).toEqual(extractPalette(pixels, { colours: CREST_LIMITS.readColours }).map((one) => one.hex));
  });

  it("has nothing to say about an empty picture, rather than guessing a colour", () => {
    expect(crestColours({ width: 0, height: 0, data: new Uint8Array(0) })).toEqual([]);
    expect(dominantOf([])).toBeNull();
    expect(primaryDrift([], "#1b2a49")).toBeNull();
  });

  it("puts the dominant colour first and carries its share", () => {
    const colours = crestColours(crestPixels(4));
    expect(colours.length).toBeGreaterThan(1);
    expect(colours[0]!.share).toBeGreaterThanOrEqual(colours[1]!.share);
  });

  it("snaps each colour to what a sublimation print is estimated to reach, and says when it had to", () => {
    const vivid = crestColours(flat("#00ff40"));
    expect(vivid).toHaveLength(1);
    expect(vivid[0]!.inGamut).toBe(false);
    expect(isInsideApproxGamut(vivid[0]!.safeHex)).toBe(true);
    expect(vivid[0]!.deltaE00).toBeGreaterThan(0);
    expect(vivid[0]!.warning).toContain(GAMUT_NOTE);
    expect(vivid[0]!.ruleId).toBe(RULES.colourTolerance);
  });

  it("changes nothing, and warns about nothing, for a colour the estimate accepts", () => {
    const navy = crestColours(flat("#1b2a49"))[0]!;
    expect(navy).toMatchObject({ hex: "#1b2a49", safeHex: "#1b2a49", inGamut: true, deltaE00: 0, warning: null });
  });
});

describe("the colours a club picks itself", () => {
  it("takes at most the three the specification allows, with an even share", () => {
    const picked = pickedColours(["#1B2A49", "#d4af37", "#c8102e", "#00843d"]);
    expect(picked.map((one) => one.hex)).toEqual(["#1b2a49", "#d4af37", "#c8102e"]);
    for (const one of picked) expect(one.share).toBeCloseTo(1 / 3, 10);
  });

  it("gives nothing for no colours", () => {
    expect(pickedColours([])).toEqual([]);
  });
});

describe("the nearest named colour", () => {
  it("never claims to be a Pantone match, and says why there is none", () => {
    expect(PANTONE_GAP).toContain("no Pantone number can be given");
    for (const entry of KNITWRIGHT_NAMED_COLOURS) expect(entry.system).toBe("Knitwright named colours");
    expect(KNITWRIGHT_NAMED_COLOURS).toHaveLength(CLUB_PALETTE.length);
  });

  it("finds the entry a colour actually is, with the difference as CIEDE2000", () => {
    const match = nearestReference("#1b2a49");
    expect(match).toMatchObject({ name: "Navy", hex: "#1b2a49" });
    expect(match!.deltaE00).toBeCloseTo(0, 6);
    const near = nearestReference("#1c2b4a")!;
    expect(near.name).toBe("Navy");
    expect(near.deltaE00).toBeCloseTo(deltaE2000(toLab("#1c2b4a"), toLab("#1b2a49")), 10);
  });

  it("has nothing to say when the book is empty, rather than inventing a name", () => {
    expect(nearestReference("#1b2a49", [])).toBeNull();
  });

  it("says what every difference figure on the screen is worked out from", () => {
    expect(DELTA_BASIS).toContain("CIEDE2000");
    expect(DELTA_BASIS).toContain("D65");
    expect(DELTA_BASIS).toContain("not a measurement");
  });
});

describe("how far a kit's body colour sits from the crest", () => {
  it("is the CIEDE2000 between the dominant colour and the colour given", () => {
    const colours = crestColours(flat("#1b2a49"));
    expect(primaryDrift(colours, "#1b2a49")).toBeCloseTo(0, 6);
    expect(primaryDrift(colours, "#c8102e")).toBeCloseTo(deltaE2000(toLab("#1b2a49"), toLab("#c8102e")), 10);
  });
});
