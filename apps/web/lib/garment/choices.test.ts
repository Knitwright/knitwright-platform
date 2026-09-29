import { describe, expect, it } from "vitest";
import { applyAction } from "./apply-action";
import { availableChoices } from "./available-choices";
import { accepted, rejected, setOption, start } from "./fixtures/specs";

describe("a choice that is not offered", () => {
  it("is refused without also quoting a rule that has nothing to do with it", () => {
    expect(rejected(applyAction(start("polo"), setOption("neckline", "v-neck")))).toBe(
      "V neck is not offered for Neckline on Polo shirt.",
    );
  });

  it("is refused for an unknown option without running the rules", () => {
    expect(rejected(applyAction(start("polo"), setOption("lining", "silk")))).toBe(
      "The option lining does not apply to Polo shirt.",
    );
  });
});

describe("availableChoices", () => {
  const jersey = start("team-jersey");

  it("lists every choice the type offers, with a label", () => {
    const list = availableChoices(jersey, "collar");
    expect(list.map((entry) => [entry.choiceId, entry.label, entry.available])).toEqual([
      ["none", "No collar", true],
      ["band-collar", "Band collar", true],
    ]);
    expect(list.every((entry) => entry.reason === null)).toBe(true);
  });

  it("greys out a choice that would break a rule and says why", () => {
    const v = accepted(applyAction(jersey, setOption("neckline", "v-neck"))).spec;
    const placket = availableChoices(v, "placket");
    expect(placket.map((entry) => [entry.choiceId, entry.available])).toEqual([
      ["none", true],
      ["buttons", false],
      ["zip", false],
    ]);
    expect(placket[1]?.reason).toBe(
      "A V neck already opens down the chest, so there is no room for a placket. Choose no placket, or a round neck.",
    );
    expect(availableChoices(v, "collar")[1]?.available).toBe(false);
  });

  it("leaves choices open when only an unrelated rule is broken", () => {
    const zip = accepted(applyAction(jersey, setOption("placket", "zip"))).spec;
    expect(availableChoices(zip, "fit").every((entry) => entry.available)).toBe(true);
  });

  it("returns nothing for an option the type does not have or an unknown type", () => {
    expect(availableChoices(start("crew-tee"), "placket")).toEqual([]);
    expect(availableChoices({ ...jersey, typeId: "kilt" }, "collar")).toEqual([]);
  });
});
