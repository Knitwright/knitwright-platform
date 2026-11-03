import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import { galleryTiles } from "@/lib/pattern-generators/gallery";
import { GENERATORS } from "@/lib/pattern-generators";
import { PatternLooks } from "./PatternLooks";
import { kitStyleOf, lookNote } from "./pattern-looks";

/**
 * Every pattern the platform can draw, under the kit styles a person can pick (decision 0124; the
 * gallery of W7c, decision 0037).
 *
 * What matters here is that no picture promises something the platform cannot do: the eight older
 * kit styles are picked from the gallery above, and the nine newer styles say they cannot be saved
 * on a design yet rather than offering a button that would do nothing.
 */

const OFFERED = ["plain", "hoops", "stripes", "fade"];

const render = (element: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&amp;", "&").replaceAll("&#xD7;", "×");

describe("what a look can be used for", () => {
  it("reads the kit style out of a generator's id, and answers null for the rest", () => {
    expect(kitStyleOf("kit-hoops")).toBe("hoops");
    expect(kitStyleOf("camo")).toBeNull();
  });

  it("sends a look this garment offers to the gallery above", () => {
    const note = lookNote("kit-hoops", OFFERED);
    expect(note.kind).toBe("pickable");
    expect(note.text).toContain("Pick this one above");
  });

  it("says plainly that a kit style this garment does not offer cannot go on it", () => {
    expect(lookNote("kit-sash", OFFERED).kind).toBe("other-garment");
  });

  it("says a style no design can store cannot be saved yet, and names where a tile comes from", () => {
    const note = lookNote("camo", OFFERED);
    expect(note.kind).toBe("not-stored");
    expect(note.text).toContain("eight kit styles");
    expect(note.text).toContain("repeat maker");
  });

  it("claims no manufacturing fact, so every note carries the gap rule", () => {
    for (const generator of GENERATORS) {
      expect(lookNote(generator.id, OFFERED).ruleId, generator.id).toBe(GAP_RULE_ID);
    }
  });
});

describe("the gallery of looks", () => {
  const tiles = galleryTiles(["#1f4fbf", "#d4af37"], "#1b2a49");

  it("has a picture for every style and preset, each with its own label", () => {
    const html = render(createElement(PatternLooks, { tiles, offered: OFFERED }));
    expect(tiles.length).toBe(GENERATORS.length * 3);
    expect(html).toContain("generator-gallery");
    expect(html).toContain(`${tiles.length} looks in your club's colours`);
    for (const tile of tiles) expect(html, tile.presetId).toContain(`aria-label="${tile.generatorLabel}, ${tile.label}"`);
  });

  it("says under every picture what can be done with it, and never shows an empty note", () => {
    const html = render(createElement(PatternLooks, { tiles, offered: OFFERED }));
    expect(html.split(GAP_RULE_ID).length - 1).toBe(tiles.length);
    expect(html).toContain("Pick this one above");
    expect(html).toContain("cannot be saved on one yet");
  });

  it("calls the pictures swatches rather than drawings of the garment", () => {
    const html = render(createElement(PatternLooks, { tiles, offered: OFFERED }));
    expect(html).toContain("not drawings of your garment");
    expect(html).not.toMatch(/\b(exact|identical|matches your)\b/i);
  });
});
