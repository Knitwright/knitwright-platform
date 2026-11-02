import { describe, expect, it } from "vitest";
import { articleBook, jersey } from "@/lib/teamwear/fixtures/kit";
import { defaultFactoryProfile } from "@/lib/validation/profile";
import { createCheckRegistry } from "@/lib/validation/registry";
import { standardRegistry } from "@/lib/validation/spec-input";
import { candidateKits, type KitCandidate } from "./engine";
import { crestPixels } from "./fixtures/crests";
import { crestColours } from "./palette";
import { ALL_SET_ASIDE, firstStopper, partInput, setAsideNote, validateCandidate, validatedKits } from "./validate";

const shirt = { id: "shirt", label: "Shirt", typeId: "football-shirt", articleCode: "JSY-SS-01" } as const;
const socks = { id: "socks", label: "Socks", typeId: "football-socks", articleCode: null } as const;

const articles = articleBook();

const candidates = (): readonly KitCandidate[] => {
  const outcome = candidateKits({ sportId: "football", feel: "modern", roles: "all", palette: crestColours(crestPixels(5)), articles, crest: null });
  if (outcome.status !== "kits") throw new Error("the fixture crest should yield kits");
  return outcome.candidates;
};

/** A candidate whose shirt holds a parameter the article does not approve. The engine cannot make one. */
const outOfRange = (candidate: KitCandidate): KitCandidate => ({
  ...candidate,
  kit: {
    ...candidate.kit,
    parts: {
      ...candidate.kit.parts,
      shirt: { ...candidate.kit.parts.shirt!, form: { options: candidate.kit.parts.shirt!.form.options, parameters: { body_length_offset: 500 } } },
    },
  },
});

describe("what the checks read about one part", () => {
  it("names the garment type, the base article and the parameters the article approves", () => {
    const input = partInput(candidates()[0]!, shirt, jersey())!;
    expect(input.typeId).toBe("football-shirt");
    expect(input.article).toMatchObject({ baseArticleCode: "JSY-SS-01", productionClass: jersey().productionClass });
    expect(input.parameterDefs?.map((def) => def.key)).toEqual(jersey().parameters.map((def) => def.key));
    expect(input.guardrails?.colours.length).toBeGreaterThan(0);
  });

  it("judges no parameter for a part with no base article, and still reads its colours", () => {
    const input = partInput(candidates()[0]!, socks, null)!;
    expect(input.article).toBeNull();
    expect(input.parameterDefs).toBeNull();
  });

  it("has nothing to read for a part the kit does not hold", () => {
    const one = candidates()[0]!;
    const withoutSocks: KitCandidate = { ...one, kit: { ...one.kit, parts: { shirt: one.kit.parts.shirt!, shorts: one.kit.parts.shorts! } } };
    expect(partInput(withoutSocks, socks, null)).toBeNull();
  });
});

describe("validating a candidate before it is shown", () => {
  it("offers every kit the engine built, because the engine can only build makeable ones", () => {
    const checked = validatedKits(candidates(), articles);
    expect(checked.offered).toHaveLength(candidates().length);
    expect(checked.setAside).toEqual([]);
    expect(checked.setAsideNote).toBeNull();
  });

  it("names a rule for every check it ran", () => {
    const validation = validateCandidate(candidates()[0]!, articles);
    expect(validation.ruleIds.length).toBeGreaterThan(0);
    for (const ruleId of validation.ruleIds) expect(ruleId).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
  });

  it("sets a kit aside when a value the factory does not approve reaches it", () => {
    const bad = outOfRange(candidates()[0]!);
    const validation = validateCandidate(bad, articles);
    expect(validation.offerable).toBe(false);
    expect(validation.blockers).toBeGreaterThan(0);
    expect(validation.findings.some((one) => one.code === "parameter-out-of-range")).toBe(true);
  });

  it("keeps a kit that fails a check off the screen and says how many were set aside", () => {
    const checked = validatedKits([outOfRange(candidates()[0]!), candidates()[1]!], articles);
    expect(checked.offered.map((one) => one.candidate.id)).toEqual([candidates()[1]!.id]);
    expect(checked.setAsideNote).toContain("1 kit was set aside");
  });

  it("says plainly when nothing may be shown, rather than leaving an empty grid", () => {
    const checked = validatedKits([outOfRange(candidates()[0]!)], articles);
    expect(checked.offered).toEqual([]);
    expect(ALL_SET_ASIDE).toContain("none is offered");
  });

  it("sets every kit aside when the factory profile does not make the garment", () => {
    const profile = { ...defaultFactoryProfile(), articles: [] };
    const checked = validatedKits(candidates(), articles, profile);
    expect(checked.offered).toEqual([]);
    expect(checked.setAside).toHaveLength(candidates().length);
  });

  it("runs the modules it is given, so a registry with none finds nothing of its own", () => {
    const validation = validateCandidate(outOfRange(candidates()[0]!), articles, defaultFactoryProfile(), createCheckRegistry());
    expect(validation.offerable).toBe(true);
    expect(validateCandidate(outOfRange(candidates()[0]!), articles, defaultFactoryProfile(), standardRegistry()).offerable).toBe(false);
  });
});
