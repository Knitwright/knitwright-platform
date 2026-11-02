import { describe, expect, it } from "vitest";
import { itemId, itemsOf, pictureLabel } from "./items";
import { colours, facts, fonts, style } from "./fixtures/proposal";

/** The rows a person says yes or no to, one at a time. */

describe("itemsOf", () => {
  const items = itemsOf({ logos: [facts()], graphics: [facts({ url: "https://ravensmoor.test/media/shirt-1.png", alt: "Home shirt" })], colours: colours(), fonts: fonts(), style: style() });

  it("gives a row per logo, colour, font role, graphic and the style, in the brand page's order", () => {
    expect(items.map((item) => item.kind)).toEqual(["logo", "colour", "colour", "font", "font", "font", "font", "font", "graphic", "style"]);
  });

  it("starts every row pending, so an import nobody looked at changes nothing", () => {
    expect(items.every((item) => item.decision === "pending")).toBe(true);
  });

  it("gives every row its own id, stable across two imports of the same site", () => {
    expect(new Set(items.map((item) => item.id)).size).toBe(items.length);
    expect(items.find((item) => item.kind === "colour")?.id).toBe(itemId("colour", "#0b1f4b"));
  });

  it("carries the notes of a colour and a font onto their rows, so every row can explain itself", () => {
    const colour = items.find((item) => item.kind === "colour");
    const font = items.find((item) => item.kind === "font");
    expect(colour?.notes.length).toBeGreaterThan(0);
    expect(font?.notes.every((note) => /^R-[A-Z]+-\d{3}$/.test(note.ruleId))).toBe(true);
  });

  it("counts the words of the visual style, so a person knows how much was written", () => {
    expect(items.at(-1)?.detail).toMatch(/^\d+ words, written from your own pictures$/);
  });

  it("has no style row when nothing was written", () => {
    const without = itemsOf({ logos: [], graphics: [], colours: [], fonts: [], style: null });
    expect(without).toEqual([]);
  });
});

describe("pictureLabel", () => {
  it("uses what the page called the picture", () => {
    expect(pictureLabel(facts())).toBe("Ravensmoor Athletic crest");
  });

  it("falls back to the file's own name when the page said nothing", () => {
    expect(pictureLabel(facts({ alt: null }))).toBe("logo.png");
    expect(pictureLabel(facts({ alt: "   " }))).toBe("logo.png");
  });

  it("drops a query string from the name", () => {
    expect(pictureLabel(facts({ alt: null, url: "https://ravensmoor.test/media/kit.png?v=3" }))).toBe("kit.png");
  });

  it("falls back to a plain word when there is no name at all", () => {
    expect(pictureLabel(facts({ alt: null, url: "https://ravensmoor.test/" }))).toBe("Logo");
  });
});
