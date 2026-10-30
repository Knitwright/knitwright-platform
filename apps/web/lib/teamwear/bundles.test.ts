import { describe, expect, it } from "vitest";
import { articleBook } from "./fixtures/kit";
import { applyBundle, bundleById, bundleColours, BUNDLES, KIT_BUNDLES, NEEDS_THIRD_COLOUR } from "./bundles";
import { kitParts, startingKit } from "./kit";
import { COLOURS_ROW } from "./rows";

const TWO = { main: "#1b2a49", second: "#d4af37", third: null } as const;
const THREE = { ...TWO, third: "#00843d" } as const;

describe("kit bundle templates", () => {
  it("offers home, away and a goalkeeper kit, each with a line a club can read", () => {
    expect(KIT_BUNDLES).toEqual(["home", "away", "gk"]);
    expect(BUNDLES.every((bundle) => bundle.hint.length > 20)).toBe(true);
    expect(bundleById("home")?.label).toBe("Home");
    expect(bundleById("nothing")).toBeUndefined();
  });

  it("puts the club's main colour on the home kit, socks included", () => {
    const home = bundleColours("home", TWO);
    expect(home).toEqual({ ok: true, colours: { colours: TWO, socksColour: "#1b2a49" } });
  });

  it("swaps the two colours for the away kit", () => {
    const away = bundleColours("away", TWO);
    expect(away.ok && away.colours.colours).toEqual({ main: "#d4af37", second: "#1b2a49", third: null });
    expect(away.ok && away.colours.socksColour).toBe("#d4af37");
  });

  it("builds a goalkeeper kit from the third colour", () => {
    const gk = bundleColours("gk", THREE);
    expect(gk.ok && gk.colours.colours).toEqual({ main: "#00843d", second: "#1b2a49", third: "#d4af37" });
    expect(gk.ok && gk.colours.socksColour).toBe("#00843d");
  });

  it("refuses a goalkeeper kit from two colours rather than inventing a third", () => {
    expect(bundleColours("gk", TWO)).toEqual({ ok: false, reason: NEEDS_THIRD_COLOUR });
  });
});

describe("applying a bundle to a kit", () => {
  it("settles the colour row on every part at once, which is what finishes a kit in ninety seconds", () => {
    const applied = applyBundle(startingKit("football", articleBook()), "away", TWO);
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;
    expect(applied.kit.bundleId).toBe("away");
    expect(applied.kit.colours.main).toBe("#d4af37");
    expect(applied.kit.socksColour).toBe("#d4af37");
    expect(kitParts(applied.kit).every((part) => part.choice.settled.includes(COLOURS_ROW))).toBe(true);
  });

  it("leaves the kit untouched when the bundle cannot be built", () => {
    const kit = startingKit("football", articleBook());
    const applied = applyBundle(kit, "gk", TWO);
    expect(applied).toEqual({ ok: false, reason: NEEDS_THIRD_COLOUR });
  });

  it("changes no option code and no parameter: a bundle holds nothing structural", () => {
    const kit = startingKit("football", articleBook());
    const applied = applyBundle(kit, "home", THREE);
    expect(applied.ok && applied.kit.parts.shirt?.form).toEqual(kit.parts.shirt?.form);
  });
});
