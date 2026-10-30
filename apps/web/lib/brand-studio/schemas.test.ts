import { describe, expect, it } from "vitest";
import { assetsSchema, deletePaletteSchema, fontsSchema, hexSchema, paletteSchema, profileSchema } from "./schemas";
import { LIMITS } from "./words";

/** What Brand Studio accepts from a browser. Every limit here is the one the database holds. */

const profile = (over: Record<string, unknown> = {}) => ({
  category: "club",
  website: "",
  about: "",
  voiceTags: [],
  setting: "",
  artDirection: "",
  rulesBoundaries: "",
  defaultSizeRange: [],
  ...over,
});

describe("profileSchema", () => {
  it("takes the brand's details and makes an empty website null", () => {
    expect(profileSchema.parse(profile())).toMatchObject({ category: "club", website: null });
  });

  it("takes a website with a scheme and a dot, and refuses anything else", () => {
    expect(profileSchema.parse(profile({ website: " https://example.test " })).website).toBe("https://example.test");
    expect(profileSchema.safeParse(profile({ website: "example.test" })).success).toBe(false);
    expect(profileSchema.safeParse(profile({ website: "javascript:alert(1)" })).success).toBe(false);
  });

  it("allows the 1,000 characters F-S9 asks for in About, and no more", () => {
    expect(profileSchema.safeParse(profile({ about: "a".repeat(LIMITS.about) })).success).toBe(true);
    expect(profileSchema.safeParse(profile({ about: "a".repeat(LIMITS.about + 1) })).success).toBe(false);
  });

  it("keeps the line breaks of About and the visual-style texts", () => {
    expect(profileSchema.parse(profile({ about: "One line.\nAnother." })).about).toBe("One line.\nAnother.");
  });

  it("refuses a control character that is not a line break", () => {
    expect(profileSchema.safeParse(profile({ about: "a\u0000b" })).success).toBe(false);
  });

  it("refuses a category the spec does not name", () => {
    expect(profileSchema.safeParse(profile({ category: "spaceship" })).success).toBe(false);
  });

  it("keeps each voice tag once, so the database's own check cannot be tripped", () => {
    expect(profileSchema.parse(profile({ voiceTags: ["bold", "bold", "premium"] })).voiceTags).toEqual(["bold", "premium"]);
  });

  it("refuses a voice tag the spec does not name", () => {
    expect(profileSchema.safeParse(profile({ voiceTags: ["angry"] })).success).toBe(false);
  });

  it("takes plain size labels and refuses one that is odd or too long", () => {
    expect(profileSchema.parse(profile({ defaultSizeRange: ["S", "M", "3XL", "M "] })).defaultSizeRange).toEqual(["S", "M", "3XL"]);
    expect(profileSchema.safeParse(profile({ defaultSizeRange: ["<script>"] })).success).toBe(false);
    expect(profileSchema.safeParse(profile({ defaultSizeRange: ["a".repeat(17)] })).success).toBe(false);
  });
});

describe("hexSchema", () => {
  it("takes a colour in any case and answers in lower case", () => {
    expect(hexSchema.parse(" #0B3D91 ")).toBe("#0b3d91");
  });

  it("refuses a colour name and a short hex", () => {
    expect(hexSchema.safeParse("navy").success).toBe(false);
    expect(hexSchema.safeParse("#abc").success).toBe(false);
  });
});

describe("paletteSchema", () => {
  const palette = (over: Record<string, unknown> = {}) => ({ paletteId: null, name: "Primary", colours: [], ...over });

  it("takes a named palette and an empty Pantone code as none", () => {
    const parsed = paletteSchema.parse(palette({ colours: [{ name: "Club red", hex: "#C8102E", pantoneTcx: "  " }] }));
    expect(parsed.colours).toEqual([{ name: "Club red", hex: "#c8102e", pantoneTcx: null }]);
  });

  it("keeps the Pantone code exactly as it was typed", () => {
    expect(paletteSchema.parse(palette({ colours: [{ name: "Navy", hex: "#0b1f4b", pantoneTcx: "19-4052 TCX" }] })).colours[0]!.pantoneTcx).toBe("19-4052 TCX");
  });

  it("asks for a name and refuses more colours than a palette holds", () => {
    expect(paletteSchema.safeParse(palette({ name: "   " })).success).toBe(false);
    const many = Array.from({ length: LIMITS.coloursPerPalette + 1 }, () => ({ name: "x", hex: "#000000", pantoneTcx: "" }));
    expect(paletteSchema.safeParse(palette({ colours: many })).success).toBe(false);
  });
});

describe("deletePaletteSchema", () => {
  it("wants a real id", () => {
    expect(deletePaletteSchema.safeParse({ paletteId: "p1" }).success).toBe(false);
    expect(deletePaletteSchema.safeParse({ paletteId: "11111111-1111-4111-8111-111111111111" }).success).toBe(true);
  });
});

describe("fontsSchema", () => {
  it("takes one font per role and a null to clear one", () => {
    const parsed = fontsSchema.parse({ fonts: [{ role: "headline", fontKey: "geist" }, { role: "body", fontKey: null }] });
    expect(parsed.fonts).toHaveLength(2);
  });

  it("refuses the same role twice and a role the spec does not name", () => {
    expect(fontsSchema.safeParse({ fonts: [{ role: "body", fontKey: "geist" }, { role: "body", fontKey: "geist-mono" }] }).success).toBe(false);
    expect(fontsSchema.safeParse({ fonts: [{ role: "footer", fontKey: "geist" }] }).success).toBe(false);
  });
});

describe("assetsSchema", () => {
  const picture = (over: Record<string, unknown> = {}) => ({
    artworkId: "11111111-1111-4111-8111-111111111111",
    label: "Main mark",
    sponsorName: "",
    printWidthMm: null,
    ...over,
  });

  it("takes a picture with no print width, because none is ever assumed", () => {
    const parsed = assetsSchema.parse({ kind: "crest", assets: [picture()] });
    expect(parsed.assets[0]).toMatchObject({ printWidthMm: null, sponsorName: null });
  });

  it("refuses more pictures than a brand may hold of that kind", () => {
    const two = [picture(), picture({ artworkId: "22222222-2222-4222-8222-222222222222" })];
    expect(assetsSchema.safeParse({ kind: "crest", assets: two }).success).toBe(false);
    expect(assetsSchema.safeParse({ kind: "logo", assets: two }).success).toBe(true);
  });

  it("refuses a print width that is not a width", () => {
    expect(assetsSchema.safeParse({ kind: "sponsor", assets: [picture({ printWidthMm: 0 })] }).success).toBe(false);
    expect(assetsSchema.safeParse({ kind: "sponsor", assets: [picture({ printWidthMm: 5000 })] }).success).toBe(false);
  });

  it("asks for a name for every picture", () => {
    expect(assetsSchema.safeParse({ kind: "logo", assets: [picture({ label: "  " })] }).success).toBe(false);
  });
});
