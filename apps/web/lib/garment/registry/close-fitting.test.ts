import { describe, expect, it } from "vitest";
import { panelsFor, pointsOfMeasureFor } from "../applicability";
import { checkCombination } from "../combinations";
import { componentSlotsFor, seamsFor } from "../construction";
import { CLOSE_FITTING } from "./close-fitting";
import { getType, listSizeSystems, listTypes, sizeSystemFor } from "./index";

const ids = (items: readonly { readonly id: string }[]): string[] => items.map((item) => item.id);
const type = (id: string) => {
  const found = getType(id);
  if (!found) throw new Error(`No type ${id}`);
  return found;
};
const offered = (typeId: string, optionId: string): string[] =>
  ids(type(typeId).options.find((option) => option.id === optionId)?.choices ?? []);
const startChoices = (typeId: string): Record<string, string> =>
  Object.fromEntries(type(typeId).options.map((option) => [option.id, option.defaultChoice]));
const pointsOf = (typeId: string, choices: Record<string, string> = {}) =>
  ids(pointsOfMeasureFor({ typeId, options: { ...startChoices(typeId), ...choices } }));

describe("close-fitting registry", () => {
  it("has a singlet, a vest, a sports bra and a compression top", () => {
    expect(ids(listTypes("close-fitting"))).toEqual(["singlet", "vest", "sports-bra", "compression-top"]);
  });

  it("makes sports bras for women and youth only, and the rest for everyone", () => {
    expect([...type("sports-bra").wearers]).toEqual(["women", "youth"]);
    for (const id of ["singlet", "vest", "compression-top"]) expect([...type(id).wearers]).toEqual(["men", "women", "youth"]);
  });

  it("adds underbust, strap width, armhole depth and back width at the narrowest", () => {
    expect(ids(CLOSE_FITTING.pointsOfMeasure)).toEqual(
      expect.arrayContaining(["underbust", "strap-width", "armhole-depth", "back-width-narrowest"]),
    );
    expect(pointsOf("sports-bra")).toEqual(
      expect.arrayContaining(["underbust", "strap-width", "armhole-depth", "back-width-narrowest"]),
    );
    expect(pointsOf("sports-bra")).not.toContain("hem-width");
    expect(pointsOf("singlet")).not.toContain("underbust");
  });

  it("measures sleeves on a compression top, and straps and armhole depth only without sleeves", () => {
    expect(pointsOf("compression-top")).toEqual(expect.arrayContaining(["sleeve-length", "upper-arm", "shoulder-width"]));
    expect(pointsOf("compression-top")).not.toContain("strap-width");
    expect(pointsOf("vest")).toContain("strap-width");
    expect(pointsOf("vest")).not.toContain("sleeve-length");
  });

  it("offers a racerback on singlets and sports bras, not on vests or compression tops", () => {
    expect(offered("singlet", "back-style")).toEqual(["straight", "racerback"]);
    expect(offered("sports-bra", "back-style")).toEqual(["straight", "racerback"]);
    expect(offered("vest", "back-style")).toEqual(["straight"]);
    expect(type("compression-top").options.some((option) => option.id === "back-style")).toBe(false);
  });

  it("refuses a racerback with sleeves and says why", () => {
    const sleeved = { ...startChoices("singlet"), sleeves: "short", "back-style": "racerback" };
    expect(checkCombination("singlet", sleeved).map((entry) => entry.ruleId)).toEqual(["racerback-has-no-sleeves"]);
  });

  it("sews with flat seams or overlock seams, as chosen, never both", () => {
    const flat = ids(seamsFor({ typeId: "compression-top", options: startChoices("compression-top") }));
    expect(flat).toEqual(expect.arrayContaining(["side-seam-flat", "shoulder-seam-flat"]));
    expect(flat).not.toContain("side-seam");
    const overlocked = ids(seamsFor({ typeId: "compression-top", options: { ...startChoices("compression-top"), "seam-type": "overlock" } }));
    expect(overlocked).toContain("side-seam");
    expect(overlocked).not.toContain("side-seam-flat");
  });

  it("gives a sports bra an underband and elastic, and bound edges a binding panel", () => {
    const bra = startChoices("sports-bra");
    expect(ids(panelsFor({ typeId: "sports-bra", options: bra }))).toEqual(["body-front", "body-back", "underband"]);
    expect(ids(componentSlotsFor({ typeId: "sports-bra", options: bra }))).toEqual(
      expect.arrayContaining(["underband-elastic", "edge-elastic", "cup-pads"]),
    );
    const bound = { ...bra, "edge-finish": "bound" };
    expect(ids(panelsFor({ typeId: "sports-bra", options: bound }))).toContain("binding");
    expect(ids(seamsFor({ typeId: "sports-bra", options: bra }))).not.toContain("body-hem");
  });
});

describe("size systems declared in the registry", () => {
  it("declares adult, youth and sports bra sizes, each with a plain explanation", () => {
    expect(ids(listSizeSystems())).toEqual(["adult", "youth", "sports-bra"]);
    for (const system of listSizeSystems()) expect(system.help.endsWith(".")).toBe(true);
  });

  it("gives men and women adult sizes and youth their own, unless a type says otherwise", () => {
    expect(sizeSystemFor("crew-tee", "men")?.id).toBe("adult");
    expect(sizeSystemFor("crew-tee", "women")?.id).toBe("adult");
    expect(sizeSystemFor("crew-tee", "youth")?.id).toBe("youth");
    expect(sizeSystemFor("singlet", "youth")?.id).toBe("youth");
  });

  it("sizes sports bras on their own system for every wearer they are made for", () => {
    expect(sizeSystemFor("sports-bra", "women")?.id).toBe("sports-bra");
    expect(sizeSystemFor("sports-bra", "youth")?.id).toBe("sports-bra");
  });

  it("has no size system for a wearer the type is not made for, or an unknown type", () => {
    expect(sizeSystemFor("sports-bra", "men")).toBeUndefined();
    expect(sizeSystemFor("kilt", "men")).toBeUndefined();
  });

  it("carries the size systems on the resolved type", () => {
    expect(type("sports-bra").sizeSystems).toEqual({ women: "sports-bra", youth: "sports-bra" });
    expect(type("polo").sizeSystems).toEqual({ men: "adult", women: "adult", youth: "youth" });
  });
});
