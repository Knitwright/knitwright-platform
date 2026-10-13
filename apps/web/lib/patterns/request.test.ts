import { describe, expect, it } from "vitest";
import { applyAction, getType } from "@/lib/garment";
import { accepted, setOption, start } from "@/lib/garment/fixtures/specs";
import { patternRequest, sizeChoices } from "./request";

describe("patternRequest", () => {
  it("names the garment, the wearer and every chosen option in words", () => {
    const spec = start("polo", "women");

    const request = patternRequest(spec, "M");

    expect(request).toMatchObject({ typeId: "polo", garment: "Polo shirt", family: "tops", wearer: "women", size: "M" });
    expect(request.options.length).toBeGreaterThan(0);
    for (const option of request.options) {
      expect(option.option).not.toBe("");
      expect(option.choice).not.toBe("");
    }
  });

  it("follows a changed option", () => {
    const base = start("crew-tee", "men");
    const option = getType("crew-tee")?.options.find((entry) => entry.choices.length > 1);
    const other = option?.choices.find((choice) => choice.id !== (base.options[option.id]?.choiceId ?? option.defaultChoice));
    if (!option || !other) throw new Error("The crew tee needs an option with two choices for this test.");
    const result = applyAction(base, setOption(option.id, other.id));

    const changed = patternRequest(accepted(result).spec, "M").options.find((entry) => entry.option === option.label);

    expect(changed?.choice).toBe(other.label);
  });

  it("gives the design's measurements in centimetres with their names, and none when none are set", () => {
    const spec = { ...start("crew-tee", "men"), measurements: [{ pointId: "chest-width", value: 5250, provenance: "user-edited" as const }] };

    const request = patternRequest(spec, "M");

    expect(request.measurements).toEqual([{ pointId: "chest-width", label: "Chest width", cm: 52.5 }]);
    expect(patternRequest(start("crew-tee", "men"), "M").measurements).toEqual([]);
  });

  it("keeps the size run when one is set", () => {
    const spec = { ...start("crew-tee", "men"), sizing: { sizes: ["S", "M", "L"], baseSize: "M" } };

    expect(patternRequest(spec, "L").sizing).toEqual({ sizes: ["S", "M", "L"], baseSize: "M" });
  });

  it("names an unknown garment by its id", () => {
    const spec = { ...start("crew-tee", "men"), typeId: "kilt" };

    expect(patternRequest(spec, "M")).toMatchObject({ garment: "kilt", family: null, options: [] });
  });
});

describe("sizeChoices", () => {
  it("offers the design's own sizes, base size first, when it has a size run", () => {
    const spec = { ...start("crew-tee", "men"), sizing: { sizes: ["S", "M", "L"], baseSize: "M" } };

    expect(sizeChoices(spec)).toEqual(["M", "S", "L"]);
  });

  it("offers the usual letter sizes when the design has none yet", () => {
    expect(sizeChoices(start("crew-tee", "men"))).toEqual(["M", "XS", "S", "L", "XL", "2XL", "3XL"]);
  });
});
