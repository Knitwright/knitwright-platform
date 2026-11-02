import { describe, expect, it } from "vitest";
import { articleBook, jersey } from "@/lib/teamwear/fixtures/kit";
import { arrangementsFor, clubColoursFor, NEEDS_ANY_COLOUR, NEEDS_SECOND_COLOUR, unarrangedRoles } from "./arrange";
import {
  candidateKits,
  fewKitsNote,
  finishGroupsOf,
  finishVariantsFor,
  MAX_FINISH_VARIANTS,
  NO_FILLS,
  NO_SHIRT_ARTICLE,
} from "./engine";
import { familiesFor, familiesWithoutCode, fillCodesOf, FILL_GROUP, MISSING_FAMILIES, TEMPLATE_FAMILIES } from "./families";
import { crestFileFixture, crestPixels } from "./fixtures/crests";
import { crestColours, pickedColours } from "./palette";
import { CREST_LIMITS, feelById, FEELS, KIT_ROLES, rolesOf } from "./settings";

const articles = articleBook();
const palette = () => crestColours(crestPixels(0));

const built = (overrides: Partial<Parameters<typeof candidateKits>[0]> = {}) =>
  candidateKits({ sportId: "football", feel: "classic", roles: "all", palette: palette(), articles, crest: null, ...overrides });

describe("the template families", () => {
  it("name a catalogue code or say plainly that no article carries one", () => {
    for (const family of TEMPLATE_FAMILIES) expect(family.code === null || /^P[0-9]{2}$/.test(family.code)).toBe(true);
    expect(MISSING_FAMILIES.map((family) => family.id)).toEqual(["banded", "diagonal", "panelled"]);
  });

  it("offers only the families whose fill code the article itself lists", () => {
    expect(fillCodesOf(jersey())).toEqual(["P00", "P01", "P02"]);
    expect(familiesFor("classic", jersey()).map((family) => family.code)).toEqual(["P00", "P01"]);
    expect(familiesWithoutCode("classic", jersey()).map((family) => family.id)).toEqual(["banded"]);
    expect(familiesFor("plain", jersey()).map((family) => family.code)).toEqual(["P00"]);
  });

  it("offers nothing for an article with no fills at all", () => {
    expect(familiesFor("bold", null)).toEqual([]);
    expect(fillCodesOf(null)).toEqual([]);
  });
});

describe("the finish combinations of a feel", () => {
  it("are built from the article's own option groups, leaving the fill group out", () => {
    expect(finishGroupsOf(jersey()).map((one) => one.group)).toEqual(["collar", "sleeve_finish"]);
    expect(finishGroupsOf(jersey()).some((one) => one.group === FILL_GROUP)).toBe(false);
  });

  it("put the feel's own preference first and hold to the article's codes", () => {
    const variants = finishVariantsFor("bold", jersey());
    expect(variants[0]).toEqual(feelById("bold").finish);
    expect(variants.length).toBeLessThanOrEqual(MAX_FINISH_VARIANTS);
    const codes = new Set(jersey().options.map((option) => option.code));
    for (const variant of variants) for (const code of Object.values(variant)) expect(codes.has(code)).toBe(true);
  });

  it("falls back to the article's own codes where a feel prefers one it does not offer", () => {
    const odd = { ...jersey(), options: jersey().options.filter((option) => option.code !== "C02") };
    const variants = finishVariantsFor("bold", odd);
    expect(variants.every((variant) => variant.collar !== "C02")).toBe(true);
    expect(variants.length).toBeGreaterThan(0);
  });
});

describe("which colour goes where", () => {
  it("uses the colour a sublimation print is estimated to reach, not the screen colour", () => {
    const colours = palette();
    const club = clubColoursFor(colours, "modern")!;
    expect(club.main).toBe(colours[0]!.safeHex);
    expect(club.second).toBe(colours[1]!.safeHex);
    expect(club.third).toBe(colours[2]!.safeHex);
  });

  it("gives a two-colour feel no third colour, so it cannot slip into a kit", () => {
    expect(clubColoursFor(palette(), "classic")!.third).toBeNull();
  });

  it("asks for a second colour rather than inventing one", () => {
    expect(clubColoursFor(pickedColours(["#1b2a49"]), "classic")).toBeNull();
    expect(arrangementsFor(pickedColours(["#1b2a49"]), "classic", ["home"])).toEqual({ ok: false, reason: NEEDS_SECOND_COLOUR });
    expect(arrangementsFor([], "classic", ["home"])).toEqual({ ok: false, reason: NEEDS_ANY_COLOUR });
  });

  it("arranges the roles Z5's own bundles arrange, and names a role it cannot", () => {
    const two = pickedColours(["#1b2a49", "#d4af37"]);
    const arranged = arrangementsFor(two, "classic", [...KIT_ROLES]);
    expect(arranged.ok && arranged.arrangements.map((one) => one.role)).toEqual(["home", "away"]);
    expect(unarrangedRoles(two, "classic", [...KIT_ROLES])[0]).toContain("Goalkeeper");
    expect(unarrangedRoles(pickedColours(["#1b2a49"]), "classic", ["home"])[0]).toContain("Home");
  });

  it("swaps the main and second colours for the away kit, as the configurator does", () => {
    const arranged = arrangementsFor(palette(), "modern", ["home", "away"]);
    expect(arranged.ok).toBe(true);
    if (!arranged.ok) return;
    const [home, away] = arranged.arrangements;
    expect(away!.colours.main).toBe(home!.colours.second);
    expect(away!.colours.second).toBe(home!.colours.main);
  });
});

describe("the kits a crest yields", () => {
  it("builds between six and nine, every role asked for among them", () => {
    const outcome = built({ feel: "modern" });
    expect(outcome.status).toBe("kits");
    if (outcome.status !== "kits") return;
    expect(outcome.candidates.length).toBeGreaterThanOrEqual(CREST_LIMITS.minKits);
    expect(outcome.candidates.length).toBeLessThanOrEqual(CREST_LIMITS.maxKits);
    expect(new Set(outcome.candidates.map((one) => one.choice.role))).toEqual(new Set(rolesOf("all")));
  });

  it("leaves the goalkeeper kit out of a two-colour feel and says why, rather than making a third colour up", () => {
    const outcome = built({ feel: "classic" });
    expect(outcome.status).toBe("kits");
    if (outcome.status !== "kits") return;
    expect(new Set(outcome.candidates.map((one) => one.choice.role))).toEqual(new Set(["home", "away"]));
    expect(outcome.notes.some((note) => note.startsWith("Goalkeeper:"))).toBe(true);
    expect(outcome.candidates.length).toBeGreaterThanOrEqual(CREST_LIMITS.minKits);
  });

  it("gives every kit an id of its own, and the same kits in the same order every run", () => {
    const first = built();
    const second = built();
    expect(first.status === "kits" && second.status === "kits" && first.candidates.map((one) => one.id)).toEqual(
      second.status === "kits" ? second.candidates.map((one) => one.id) : [],
    );
    if (first.status !== "kits") return;
    expect(new Set(first.candidates.map((one) => one.id)).size).toBe(first.candidates.length);
  });

  it("writes only codes the article offers into the shirt's form", () => {
    const outcome = built();
    if (outcome.status !== "kits") return;
    const offered = new Map<string, Set<string>>();
    for (const option of jersey().options) offered.set(option.group, (offered.get(option.group) ?? new Set()).add(option.code));
    for (const candidate of outcome.candidates) {
      for (const [group, code] of Object.entries(candidate.kit.parts.shirt!.form.options)) {
        expect(offered.get(group)?.has(code), `${candidate.id} ${group}=${code}`).toBe(true);
      }
    }
  });

  it("sets the fill the family names on every kit", () => {
    const outcome = built({ feel: "modern", roles: "home" });
    if (outcome.status !== "kits") return;
    for (const candidate of outcome.candidates) {
      expect(candidate.kit.parts.shirt!.form.options[FILL_GROUP], candidate.id).toBe(candidate.choice.family.code);
    }
  });

  it("holds every parameter at the value the article is drafted at", () => {
    const outcome = built({ roles: "home" });
    if (outcome.status !== "kits") return;
    const defaults = Object.fromEntries(jersey().parameters.map((def) => [def.key, def.defaultValue]));
    for (const candidate of outcome.candidates) expect(candidate.kit.parts.shirt!.form.parameters).toEqual(defaults);
  });

  it("names the crest as an element only when there is one", () => {
    const without = built({ roles: "home" });
    expect(without.status === "kits" && without.candidates[0]!.kit.elements).toEqual([]);
    const withCrest = built({ roles: "home", crest: crestFileFixture(0, 64) });
    expect(withCrest.status === "kits" && withCrest.candidates[0]!.kit.elements).toEqual(["crest"]);
  });

  it("carries the kit's colours onto the socks, which have no article", () => {
    const outcome = built({ roles: "home" });
    if (outcome.status !== "kits") return;
    const candidate = outcome.candidates[0]!;
    expect(candidate.kit.socksColour).toBe(candidate.kit.colours.main);
    expect(candidate.kit.parts.socks).toBeDefined();
  });

  it("names a family the catalogue has no fill code for, rather than silently leaving it out", () => {
    const outcome = built();
    expect(outcome.notes.some((note) => note.includes("bands"))).toBe(true);
  });

  it("says plainly that a sport with no base article yields nothing", () => {
    expect(built({ sportId: "winter-code" })).toMatchObject({ status: "none", reason: NO_SHIRT_ARTICLE });
  });

  it("says plainly that an article with no fills yields nothing", () => {
    const bare = new Map(articles);
    bare.set("JSY-SS-01", { ...jersey(), options: jersey().options.filter((option) => option.group !== FILL_GROUP) });
    expect(candidateKits({ sportId: "football", feel: "classic", roles: "home", palette: palette(), articles: bare, crest: null })).toMatchObject({
      status: "none",
      reason: NO_FILLS,
    });
  });

  it("says how many it built when it built fewer than six", () => {
    expect(fewKitsNote(1)).toContain("1 kit");
    expect(fewKitsNote(4)).toContain("4 kits");
  });

  it("works for every feel the screen offers", () => {
    for (const feel of FEELS) {
      const outcome = built({ feel, roles: "home" });
      expect(outcome.status, feel).toBe("kits");
    }
  });
});
