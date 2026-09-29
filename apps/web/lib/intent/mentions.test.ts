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
});
