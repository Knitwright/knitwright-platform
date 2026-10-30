import { describe, expect, it } from "vitest";
import { DEFAULT_CLUB_COLOURS } from "@/lib/kit-styles/presets";
import { articleBook, jersey, shorts } from "./fixtures/kit";
import {
  articleOf,
  chooseOption,
  chooseParameter,
  DEFAULT_QUANTITY,
  ELEMENT_SLOTS,
  kitParts,
  partOf,
  partsForSport,
  settle,
  settleEverywhere,
  startingKit,
  totalPieces,
  withPart,
} from "./kit";
import { COLOURS_ROW } from "./rows";
import { sportById, SPORTS } from "./vocabulary";

describe("the parts of a kit", () => {
  it("gives football a shirt, shorts and socks, each on its own registry type", () => {
    expect(partsForSport(sportById("football"))).toEqual([
      { id: "shirt", label: "Shirt", typeId: "football-shirt", articleCode: "JSY-SS-01" },
      { id: "shorts", label: "Shorts", typeId: "football-shorts", articleCode: "SHO-TR-01" },
      { id: "socks", label: "Socks", typeId: "football-socks", articleCode: null },
    ]);
  });

  it("leaves out a part the sport has no registry type for", () => {
    expect(partsForSport(sportById("winter-code")).map((part) => part.id)).toEqual(["shirt"]);
    expect(partsForSport(sportById("cricket")).map((part) => part.id)).toEqual(["shirt", "shorts"]);
  });

  it("marks the socks as having no base article, because the catalogue covers no sock", () => {
    const socks = partOf(sportById("football"), "socks");
    expect(socks?.articleCode).toBeNull();
    expect(articleOf(socks!, articleBook())).toBeNull();
  });

  it("has no part for an unknown one", () => {
    expect(partOf(sportById("winter-code"), "socks")).toBeUndefined();
  });

  it("names a sport for every family the configurator offers, each with a backdrop", () => {
    for (const sport of SPORTS) expect(sport.backdrop).toBe("pitch");
  });
});

describe("a starting kit", () => {
  it("starts every part on its article's own default option codes", () => {
    const kit = startingKit("football", articleBook());
    expect(kit.parts.shirt?.form.options).toEqual({ collar: "C01", sleeve_finish: "K01", pattern_fill: "P00" });
    expect(kit.parts.shirt?.form.parameters).toEqual({ body_length_offset: 0, sleeve_length_offset: 0, back_drop_tail: 0 });
  });

  it("starts a part whose article has no options with an empty form, not with made-up ones", () => {
    const kit = startingKit("football", articleBook());
    expect(shorts().options).toEqual([]);
    expect(kit.parts.shorts?.form).toEqual({ options: {}, parameters: {} });
    expect(kit.parts.socks?.form).toEqual({ options: {}, parameters: {} });
  });

  it("starts in the club's colours, with the socks in the second colour, nothing settled and no bundle", () => {
    const kit = startingKit("football", articleBook());
    expect(kit.colours).toEqual(DEFAULT_CLUB_COLOURS);
    expect(kit.socksColour).toBe(DEFAULT_CLUB_COLOURS.second);
    expect(kit.bundleId).toBeNull();
    expect(kit.namesNumbers).toBe(false);
    expect(kit.elements).toEqual([]);
    expect(kit.wearer).toBe("men");
    expect(kitParts(kit).every((part) => part.choice.settled.length === 0)).toBe(true);
  });

  it("falls back to football for a sport nobody offers", () => {
    expect(startingKit("quidditch", articleBook()).sportId).toBe("football");
  });

  it("counts every piece in the kit, which is the quantity the tier is read at", () => {
    const kit = startingKit("football", articleBook());
    expect(totalPieces(kit)).toBe(DEFAULT_QUANTITY * 3);
  });

  it("offers the crest and three sponsor slots the spec fixes, and one text slot", () => {
    expect(ELEMENT_SLOTS.filter((slot) => slot.startsWith("sponsor"))).toHaveLength(3);
    expect(ELEMENT_SLOTS).toContain("crest");
  });
});

describe("choosing an option", () => {
  it("keeps a code the article offers and marks the row settled", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "shirt", (choice) => chooseOption(choice, jersey(), "collar", "C02", "option:collar"));
    expect(next.parts.shirt?.form.options.collar).toBe("C02");
    expect(next.parts.shirt?.settled).toEqual(["option:collar"]);
  });

  it("refuses a code the article does not offer and falls back to its default", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "shirt", (choice) => chooseOption(choice, jersey(), "collar", "C99", "option:collar"));
    expect(next.parts.shirt?.form.options.collar).toBe("C01");
  });

  it("changes nothing for a part with no article, because there is nothing approved to choose from", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "socks", (choice) => chooseOption(choice, null, "collar", "C02", "option:collar"));
    expect(next.parts.socks).toEqual(kit.parts.socks);
  });

  it("leaves a part the kit does not hold alone", () => {
    const kit = startingKit("winter-code", articleBook());
    expect(withPart(kit, "socks", (choice) => choice)).toBe(kit);
  });
});

describe("choosing a parameter", () => {
  it("keeps a value inside the range the factory approved, on its step", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "shirt", (choice) => chooseParameter(choice, jersey(), "body_length_offset", 20, "parameters"));
    expect(next.parts.shirt?.form.parameters.body_length_offset).toBe(20);
  });

  it("refuses a value past the end of the range and falls back to the article's default", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "shirt", (choice) => chooseParameter(choice, jersey(), "body_length_offset", 500, "parameters"));
    expect(next.parts.shirt?.form.parameters.body_length_offset).toBe(0);
  });

  it("refuses a value off the step, so a hand-typed number cannot land between two the factory makes", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "shirt", (choice) => chooseParameter(choice, jersey(), "body_length_offset", 15, "parameters"));
    expect(next.parts.shirt?.form.parameters.body_length_offset).toBe(0);
  });

  it("changes nothing for a part with no article", () => {
    const kit = startingKit("football", articleBook());
    const next = withPart(kit, "socks", (choice) => chooseParameter(choice, null, "body_length_offset", 20, "parameters"));
    expect(next.parts.socks).toEqual(kit.parts.socks);
  });
});

describe("settling a row", () => {
  it("settles a row once, however often it is answered", () => {
    const kit = startingKit("football", articleBook());
    const once = settle(kit.parts.shirt!, COLOURS_ROW);
    expect(settle(once, COLOURS_ROW)).toBe(once);
  });

  it("settles a kit-wide row on every part at once", () => {
    const kit = settleEverywhere(startingKit("football", articleBook()), COLOURS_ROW);
    expect(kitParts(kit).map((part) => part.choice.settled)).toEqual([[COLOURS_ROW], [COLOURS_ROW], [COLOURS_ROW]]);
  });
});
