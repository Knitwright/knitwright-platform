import { describe, expect, it } from "vitest";
import { bare } from "@/lib/editor/fixtures/article";
import { panelsFor } from "@/lib/garment";
import { RULE_ID } from "@/lib/rulebook/constants";
import { applyItem, panelsOf } from "./apply";
import { design } from "./fixtures/design";
import { libraryGroups, type LibraryItem } from "./library";
import { NO_GRAPHICS, NO_OWN_LIBRARY, standInColourSearch, standInGraphics, standInYourLibrary } from "./library-ports";
import { PALETTE_RULE_ID, SPORTSWEAR_PALETTES } from "./palettes";

const groups = (over = {}) => libraryGroups(design(over));
const section = (id: string, over = {}) => groups(over).flatMap((group) => group.sections).find((entry) => entry.id === id);
const items = (id: string, over = {}): readonly LibraryItem[] => section(id, over)?.items ?? [];

describe("the Library toolbar", () => {
  it("has the three groups of spec F-S4, in the order it draws them", () => {
    expect(groups().map((group) => group.id)).toEqual(["knitwright", "yours", "inspiration"]);
  });

  it("has the Knitwright sections the spec names", () => {
    expect(groups()[0]?.sections.map((entry) => entry.title)).toEqual(["Fabrics", "Colours", "Pattern fills", "Graphics"]);
  });

  it("has Your library's four sections, each saying why it cannot read them yet", () => {
    const yours = groups()[1];
    expect(yours?.sections.map((entry) => entry.title)).toEqual(["Brand kit", "Palettes", "Pattern fills", "Uploads"]);
    expect(yours?.sections.every((entry) => entry.empty === NO_OWN_LIBRARY)).toBe(true);
  });

  it("leaves Inspiration a labelled slot for wave 3", () => {
    expect(groups()[2]?.sections[0]?.empty).toMatch(/wave 3/);
  });

  it("gives every item a rule id of the rulebook's own form", () => {
    const all = groups().flatMap((group) => group.sections).flatMap((entry) => entry.items);
    expect(all.length).toBeGreaterThan(10);
    expect(all.filter((item) => !RULE_ID.test(item.ruleId))).toEqual([]);
  });
});

describe("fabrics", () => {
  it("lists the base article's own allowed fabrics with their spec cards", () => {
    const fabrics = items("kw-fabrics");
    expect(fabrics.map((item) => item.code)).toEqual(["F-POLY-INT", "F-POLY-RIB"]);
    expect(fabrics[0]?.card.map((row) => row.label)).toEqual(expect.arrayContaining(["Role", "Weight", "Width", "Press shrink, length"]));
  });

  it("carries the catalogue's own label, so nobody reads a draft as a factory's word", () => {
    expect(section("kw-fabrics")?.note).toMatch(/not reviewed by a factory/i);
  });

  it("says there is no approved list for a design with no base article", () => {
    expect(section("kw-fabrics", { article: null })?.empty).toMatch(/not on a base article/);
  });

  it("shows the bare codes of a draft article, and no spec card it has no data for", () => {
    const drafted = items("kw-fabrics", { article: bare() });
    expect(drafted.length).toBeGreaterThan(0);
    expect(drafted.every((item) => item.code !== null)).toBe(true);
    expect(drafted.flatMap((item) => item.card)).toEqual([]);
  });
});

describe("colours", () => {
  it("offers the three sportswear palettes the spec names", () => {
    const labels = items("kw-colours").map((item) => item.label);
    for (const palette of SPORTSWEAR_PALETTES) expect(labels.some((label) => label.startsWith(palette.label))).toBe(true);
  });

  it("explains that a screen colour is not a colour reference, and that TCX is not searched here", () => {
    expect(section("kw-colours")?.note).toMatch(/Screen colours only/);
    expect(section("kw-colours")?.note).toMatch(/licensed/);
    expect(items("kw-colours").every((item) => item.ruleId === PALETTE_RULE_ID)).toBe(true);
  });

  it("draws every swatch as a screen colour", () => {
    expect(items("kw-colours").filter((item) => item.swatch === null || !/^#[0-9a-f]{6}$/.test(item.swatch))).toEqual([]);
  });
});

describe("pattern fills", () => {
  const fills = items("kw-pattern-fills");

  it("puts the base article's approved options first, with their catalogue codes", () => {
    expect(fills.slice(0, 3).map((item) => item.code)).toEqual(["P00", "P01", "P02"]);
  });

  it("then offers every style the platform can draw, with its repeat and colour count", () => {
    const style = fills.find((item) => item.id.startsWith("fill-kit-hoops"));
    expect(style?.card.map((row) => row.label)).toEqual(["Repeat", "Colours"]);
  });

  it("says which styles a design cannot store yet instead of pretending it can", () => {
    const camo = fills.find((item) => item.id.startsWith("fill-camo"));
    expect(camo?.apply).toMatchObject({ kind: "none" });
  });
});

describe("the ports that are not wired", () => {
  it("say plainly that they are not available, and cost nothing to call", async () => {
    expect(await standInColourSearch.search("19-4024")).toMatchObject({ available: false, items: [] });
    expect(await standInGraphics.list()).toMatchObject({ available: false, reason: NO_GRAPHICS });
    expect(await standInYourLibrary.list()).toMatchObject({ available: false, reason: NO_OWN_LIBRARY });
  });

  it("leaves the Graphics section labelled with the port's own words", () => {
    expect(section("kw-graphics")?.empty).toBe(NO_GRAPHICS);
    expect(applyItem(design(), { ...(items("kw-fabrics")[0] as LibraryItem), kind: "graphic" }, { kind: "all" })).toMatchObject({ ok: false });
  });
});

describe("panelsOf", () => {
  it("is every panel of the garment for a click, and the one panel for a drag", () => {
    expect(panelsOf(design(), { kind: "all" })).toEqual(panelsFor(design().spec).map((panel) => panel.id));
    expect(panelsOf(design(), { kind: "panel", panelId: "body-front" })).toEqual(["body-front"]);
  });
});
