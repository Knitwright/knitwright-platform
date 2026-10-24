import { describe, expect, it } from "vitest";
import { EMPTY_KIT, hasAnyKit, kitFromRow, kitSchema } from "./kit";

const FILE = "6f1c1b0e-6a39-4b0e-8f0e-2b6a1d2f3c4d";

describe("kitSchema", () => {
  it("lower-cases and trims colours", () => {
    const kit = kitSchema.parse({ ...EMPTY_KIT, primaryColour: " #0B3D91 " });
    expect(kit.primaryColour).toBe("#0b3d91");
  });

  it.each(["blue", "#fff", "#12345g", "0b3d91"])("refuses the colour %s", (bad) => {
    expect(kitSchema.safeParse({ ...EMPTY_KIT, accentColour: bad }).success).toBe(false);
  });

  it("allows up to three sponsors and refuses a fourth", () => {
    const sponsor = (n: number) => ({ name: `Shop ${n}`, logoFileId: null });
    expect(kitSchema.safeParse({ ...EMPTY_KIT, sponsors: [1, 2, 3].map(sponsor) }).success).toBe(true);
    expect(kitSchema.safeParse({ ...EMPTY_KIT, sponsors: [1, 2, 3, 4].map(sponsor) }).success).toBe(false);
  });

  it("cleans a sponsor name and refuses markup", () => {
    const ok = kitSchema.parse({ ...EMPTY_KIT, sponsors: [{ name: "  Bob's   Bakery ", logoFileId: FILE }] });
    expect(ok.sponsors[0]?.name).toBe("Bob's Bakery");
    expect(kitSchema.safeParse({ ...EMPTY_KIT, sponsors: [{ name: "<b>x</b>", logoFileId: null }] }).success).toBe(false);
    expect(kitSchema.safeParse({ ...EMPTY_KIT, sponsors: [{ name: "  ", logoFileId: null }] }).success).toBe(false);
  });

  it("accepts only the bundled font", () => {
    expect(kitSchema.safeParse({ ...EMPTY_KIT, nameFont: "comic-sans" }).success).toBe(false);
  });
});

describe("kitFromRow", () => {
  it("reads a stored row", () => {
    const kit = kitFromRow({ primary_colour: "#0b3d91", secondary_colour: null, accent_colour: null, crest_file_id: FILE, sponsors: [{ name: "Bakery", logoFileId: null }], name_font: "geist", number_font: "geist" });
    expect(kit.primaryColour).toBe("#0b3d91");
    expect(kit.crestFileId).toBe(FILE);
    expect(kit.sponsors).toHaveLength(1);
  });

  it("reads anything unexpected as no kit", () => {
    expect(kitFromRow(null)).toEqual(EMPTY_KIT);
    expect(kitFromRow({ primary_colour: "red" })).toEqual(EMPTY_KIT);
    expect(kitFromRow({ primary_colour: "red", secondary_colour: null, accent_colour: null, crest_file_id: null, sponsors: [], name_font: "geist", number_font: "geist" })).toEqual(EMPTY_KIT);
  });
});

describe("hasAnyKit", () => {
  it("is false for an empty kit and true once anything is chosen", () => {
    expect(hasAnyKit(EMPTY_KIT)).toBe(false);
    expect(hasAnyKit({ ...EMPTY_KIT, accentColour: "#000000" })).toBe(true);
    expect(hasAnyKit({ ...EMPTY_KIT, sponsors: [{ name: "A", logoFileId: null }] })).toBe(true);
  });
});
