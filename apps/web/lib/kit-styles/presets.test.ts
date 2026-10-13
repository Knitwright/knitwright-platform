import { describe, expect, it } from "vitest";
import { applyAction, type GarmentSpec } from "@/lib/garment";
import { start } from "@/lib/garment/fixtures/specs";
import {
  CLUB_PALETTE,
  DEFAULT_CLUB_COLOURS,
  clubColoursFrom,
  kitStyleActions,
  kitStyleSentence,
  kitStylesFor,
  readClubColours,
  styleOf,
  withKitStyle,
  type ClubColours,
} from "./presets";

const NAVY = "#1b2a49";
const GOLD = "#d4af37";
const WHITE = "#ffffff";
const club: ClubColours = { main: NAVY, second: GOLD, third: null };

function applied(spec: GarmentSpec, styleId: string, colours: ClubColours = club): GarmentSpec {
  const outcome = withKitStyle(spec, styleId, colours);
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome.spec;
}

const swatchOf = (spec: GarmentSpec, panelId: string): string | undefined =>
  spec.colourways[0].colours.find((entry) => entry.panelId === panelId)?.swatch;

describe("the kit styles a garment offers", () => {
  it("gives jerseys every style, polos and tees fewer, and other garments none", () => {
    expect(kitStylesFor("team-jersey").map((style) => style.id)).toEqual([
      "plain",
      "hoops",
      "stripes",
      "pinstripes",
      "sash",
      "side-panels",
      "chest-band",
      "fade",
    ]);
    expect(kitStylesFor("polo")).toHaveLength(7);
    expect(kitStylesFor("crew-tee").length).toBeGreaterThanOrEqual(4);
    expect(kitStylesFor("joggers")).toEqual([]);
    for (const typeId of ["team-jersey", "polo", "crew-tee", "v-neck-tee", "long-sleeve-tee"]) {
      const count = kitStylesFor(typeId).length;
      expect(count).toBeGreaterThanOrEqual(4);
      expect(count).toBeLessThanOrEqual(8);
    }
  });

  it("finds a style by id, and nothing for an id it does not know", () => {
    expect(styleOf("sash")?.label).toBe("Sash");
    expect(styleOf("tartan")).toBeUndefined();
  });
});

describe("applying a kit style", () => {
  it("colours the body and sleeves in the main colour and the trims in the second, and prints the pattern", () => {
    const spec = applied(start("team-jersey"), "hoops");
    expect(swatchOf(spec, "body-front")).toBe(NAVY);
    expect(swatchOf(spec, "sleeve-left")).toBe(NAVY);
    expect(swatchOf(spec, "neckband")).toBe(GOLD);
    expect(spec.kitPattern).toMatchObject({ style: "hoops", colours: [{ colour: "", swatch: GOLD }], provenance: "user-edited" });
    expect(spec.kitPattern?.size).toBeGreaterThan(0);
  });

  it("stores a picked colour as a screen colour only, never as a colour reference", () => {
    const spec = applied(start("polo"), "plain");
    expect(spec.colourways[0].colours.every((entry) => entry.colour === "")).toBe(true);
  });

  it("prints a second pattern colour when a third club colour is chosen", () => {
    const spec = applied(start("team-jersey"), "stripes", { ...club, third: WHITE });
    expect(spec.kitPattern?.colours.map((entry) => entry.swatch)).toEqual([GOLD, WHITE]);
  });

  it("makes a plain kit with no pattern, removing one that was there", () => {
    const striped = applied(start("team-jersey"), "stripes");
    const plain = applied(striped, "plain");
    expect(Object.hasOwn(plain, "kitPattern")).toBe(false);
    expect(swatchOf(plain, "body-back")).toBe(NAVY);
    expect(kitStyleActions(start("team-jersey"), "plain", club)).toMatchObject({ ok: true });
  });

  it("marks a fade as sublimated, the only way to print one", () => {
    expect(applied(start("crew-tee"), "fade").kitPattern?.technique).toBe("sublimation");
  });

  it("colours a sewn side panel and a polo collar in the second colour", () => {
    const loaded = applyAction(start("team-jersey"), { type: "set-option", optionId: "side-panels", choiceId: "contrast-insert", provenance: "user-edited" });
    if (!loaded.ok) throw new Error(loaded.reason);
    expect(swatchOf(applied(loaded.spec, "plain"), "side-panels")).toBe(GOLD);
    expect(swatchOf(applied(start("polo"), "plain"), "collar")).toBe(GOLD);
  });

  it("keeps the other colourways and the colour of parts it does not set", () => {
    const spec = applied(start("polo"), "hoops");
    expect(spec.colourways).toHaveLength(1);
    expect(spec.colourways[0].id).toBe(start("polo").colourways[0].id);
  });

  it("refuses a style the garment does not offer, and a garment with no styles", () => {
    expect(kitStyleActions(start("polo"), "sash", club)).toEqual({ ok: false, reason: "Polo shirt does not come in that kit style." });
    expect(kitStyleActions(start("joggers"), "plain", club)).toMatchObject({ ok: false });
    expect(kitStyleActions(start("polo"), "hoops", club, "no-such-colourway")).toMatchObject({ ok: false });
  });

  it("says what it did in one plain sentence", () => {
    expect(kitStyleSentence("hoops", club)).toBe("Kit style Hoops, with a main colour and one more.");
    expect(kitStyleSentence("plain", { ...club, third: WHITE })).toBe("Kit style Plain, with a main colour and two more.");
  });
});

describe("club colours", () => {
  it("starts from the design's own colours when it has them, or a default set", () => {
    expect(clubColoursFrom(start("polo"))).toEqual(DEFAULT_CLUB_COLOURS);
    const spec = applied(start("team-jersey"), "stripes", { main: "#7a1f2b", second: WHITE, third: GOLD });
    expect(clubColoursFrom(spec)).toEqual({ main: "#7a1f2b", second: WHITE, third: GOLD });
  });

  it("reads colours from the address, keeping only real colours and falling back for the rest", () => {
    expect(readClubColours({ main: "1b2a49", second: "#D4AF37", third: "none" }, DEFAULT_CLUB_COLOURS)).toEqual({
      main: NAVY,
      second: GOLD,
      third: null,
    });
    expect(readClubColours({ main: ["x"], second: "red" }, club)).toEqual(club);
  });

  it("names every colour in the palette once", () => {
    expect(new Set(CLUB_PALETTE.map((entry) => entry.swatch)).size).toBe(CLUB_PALETTE.length);
    expect(CLUB_PALETTE.length).toBeGreaterThanOrEqual(10);
  });
});
