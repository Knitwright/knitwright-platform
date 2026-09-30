import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import { choiceTarget, findMentions, isStated, typeTarget, wearerTarget } from "./mentions";
import { VOCABULARY } from "./vocabulary";

const stated = (utterance: string, target: string): boolean => isStated(findMentions(utterance), target);

describe("what an instruction states outright", () => {
  it("finds a garment type by name, whatever the case and punctuation", () => {
    expect(stated("Make it a POLO!", typeTarget("polo"))).toBe(true);
    expect(stated("change to a long-sleeve tee", typeTarget("long-sleeve-tee"))).toBe(true);
    expect(stated("turn it into a V-neck T-shirt", typeTarget("v-neck-tee"))).toBe(true);
  });

  it("reads the longest phrase first, so a polo collar is not a polo shirt", () => {
    const found = findMentions("add a polo collar");
    expect(isStated(found, choiceTarget("collar", "polo-collar"))).toBe(true);
    expect(isStated(found, typeTarget("polo"))).toBe(false);
  });

  it("does not count a thing that is refused or replaced", () => {
    expect(stated("don't make it a polo, just add a zip", typeTarget("polo"))).toBe(false);
    expect(stated("don't make it a polo, just add a zip", choiceTarget("placket", "zip"))).toBe(true);
    expect(stated("raglan instead of set-in", choiceTarget("sleeve-type", "set-in"))).toBe(false);
    expect(stated("raglan instead of set-in", choiceTarget("sleeve-type", "raglan"))).toBe(true);
    expect(stated("rather than a crew neck tee, a jersey", typeTarget("crew-tee"))).toBe(false);
  });

  it("lets a new sentence end a refusal", () => {
    expect(stated("No. Make it a polo.", typeTarget("polo"))).toBe(true);
  });

  it("reads a removal as its own choice, not as the thing removed", () => {
    const found = findMentions("remove the cuffs");
    expect(isStated(found, choiceTarget("cuffs", "none"))).toBe(true);
    expect(isStated(found, choiceTarget("cuffs", "rib-cuff"))).toBe(false);
  });

  it("finds the wearer", () => {
    expect(stated("something for the ladies", wearerTarget("women"))).toBe(true);
    expect(stated("men's fit", wearerTarget("men"))).toBe(true);
    expect(stated("for my son", wearerTarget("youth"))).toBe(false);
  });

  it("finds nothing in text that names nothing", () => {
    expect(findMentions("")).toEqual([]);
    expect(findMentions("make it sportier")).toEqual([]);
  });

  it("has a phrase for every tops garment type and every choice of every tops option", () => {
    const targets = new Set(VOCABULARY.map((entry) => entry.target));
    for (const type of listTypes("tops")) {
      expect(targets.has(typeTarget(type.id))).toBe(true);
      for (const option of type.options) {
        for (const choice of option.choices) expect(targets.has(choiceTarget(option.id, choice.id))).toBe(true);
      }
    }
  });

  it("finds every family a phrase names, so one phrase can name the same kind of choice on a top and on joggers", () => {
    const found = findMentions("ribbed cuffs please");
    expect(isStated(found, choiceTarget("cuffs", "rib-cuff"))).toBe(true);
    expect(isStated(found, choiceTarget("leg-finish", "rib-cuff"))).toBe(true);
    const refused = findMentions("not ribbed cuffs");
    expect(isStated(refused, choiceTarget("leg-finish", "rib-cuff"))).toBe(false);
  });
});

describe("the words for bottoms", () => {
  it("has a phrase for every bottoms garment type and every choice of every bottoms option", () => {
    const targets = new Set(VOCABULARY.map((entry) => entry.target));
    for (const type of listTypes("bottoms")) {
      expect(targets.has(typeTarget(type.id)), type.id).toBe(true);
      for (const option of type.options) {
        for (const choice of option.choices) expect(targets.has(choiceTarget(option.id, choice.id)), `${option.id}:${choice.id}`).toBe(true);
      }
    }
  });

  it("reads the longest phrase, so shorts are not a short leg and a zipped pocket is not a plain pocket", () => {
    expect(stated("make them shorts", typeTarget("shorts"))).toBe(true);
    expect(stated("make them shorts", choiceTarget("leg-length", "short"))).toBe(false);
    expect(stated("zipped pockets", choiceTarget("pockets", "zip-side"))).toBe(true);
    expect(stated("zipped pockets", choiceTarget("pockets", "side-seam"))).toBe(false);
    expect(stated("elastic waistband with a drawcord", choiceTarget("waistband", "elastic-drawcord"))).toBe(true);
    expect(stated("elastic waistband with a drawcord", choiceTarget("waistband", "elastic"))).toBe(false);
  });

  it("reads a removal as its own choice", () => {
    expect(stated("remove the drawcord", choiceTarget("waistband", "elastic"))).toBe(true);
    expect(stated("remove the drawcord", choiceTarget("waistband", "elastic-drawcord"))).toBe(false);
    expect(stated("no gusset", choiceTarget("gusset", "none"))).toBe(true);
    expect(stated("no gusset", choiceTarget("gusset", "crotch-gusset"))).toBe(false);
  });

  it("names no bottoms type from a hint", () => {
    const found = findMentions("make them for running");
    expect(found.some((mention) => mention.target.startsWith("type:"))).toBe(false);
  });
});

describe.each(["outerwear", "close-fitting"] as const)("the words for %s", (family) => {
  it("has a phrase for every garment type and every choice of every option", () => {
    const targets = new Set(VOCABULARY.map((entry) => entry.target));
    for (const type of listTypes(family)) {
      expect(targets.has(typeTarget(type.id)), type.id).toBe(true);
      for (const option of type.options) {
        for (const choice of option.choices) expect(targets.has(choiceTarget(option.id, choice.id)), `${option.id}:${choice.id}`).toBe(true);
      }
    }
  });
});

describe("the words for outerwear and close-fitting garments", () => {
  it("names no hoodie type from the word hoodie alone", () => {
    const found = findMentions("make it a hoodie");
    expect(found.some((mention) => mention.target.startsWith("type:"))).toBe(false);
  });

  it("reads the longest phrase, so a zip hoodie is a type and a lined hood is not an unlined one", () => {
    expect(stated("make it a zip hoodie", typeTarget("zip-hoodie"))).toBe(true);
    expect(stated("make it a zip hoodie", choiceTarget("front-opening", "full-zip"))).toBe(false);
    expect(stated("unlined hood", choiceTarget("hood", "single-layer"))).toBe(true);
    expect(stated("unlined hood", choiceTarget("hood", "lined"))).toBe(false);
    expect(stated("kangaroo pocket", choiceTarget("pockets", "kangaroo"))).toBe(true);
  });

  it("reads one phrase as the same kind of choice in every family that has it", () => {
    const found = findMentions("remove the drawcord");
    expect(isStated(found, choiceTarget("hood-drawcord", "none"))).toBe(true);
    expect(isStated(found, choiceTarget("waistband", "elastic"))).toBe(true);
    const sleeves = findMentions("long sleeves");
    expect(isStated(sleeves, choiceTarget("sleeves", "long"))).toBe(true);
    expect(isStated(sleeves, choiceTarget("sleeve-length", "long"))).toBe(true);
  });

  it("reads close-fitting choices and refusals", () => {
    expect(stated("racerback please", choiceTarget("back-style", "racerback"))).toBe(true);
    expect(stated("not a racerback", choiceTarget("back-style", "racerback"))).toBe(false);
    expect(stated("flatlock seams", choiceTarget("seam-type", "flatlock"))).toBe(true);
    expect(stated("covered elastic underband", choiceTarget("underband", "covered-elastic"))).toBe(true);
    expect(stated("make it a sports bra", typeTarget("sports-bra"))).toBe(true);
  });
});
