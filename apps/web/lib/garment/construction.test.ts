import { describe, expect, it } from "vitest";
import {
  componentSlotsFor,
  listSeamClasses,
  listStitchClasses,
  seamClassById,
  seamsFor,
  stitchClassById,
} from "./index";
import { allCombinations } from "./fixtures/combinations";
import { start } from "./fixtures/specs";
import { checkCombination, listTypes, panelsFor } from "./index";
import { TOPS } from "./registry/tops";

const seamIds = (typeId: string, choices: Record<string, string> = {}): string[] => {
  const base = start(typeId);
  const options = Object.fromEntries(
    Object.entries(choices).map(([id, choiceId]) => [id, { choiceId, provenance: "user-edited" as const }]),
  );
  return seamsFor({ typeId, options: { ...base.options, ...options } }).map((seam) => seam.id);
};

describe("stitch and seam classes", () => {
  it("names the ISO stitch types a factory reads, each with a plain explanation", () => {
    const stitches = listStitchClasses();
    expect(stitches.map((stitch) => stitch.iso)).toEqual(["301", "401", "504", "514", "602", "605"]);
    for (const stitch of stitches) {
      expect(stitch.name.length).toBeGreaterThan(3);
      expect(stitch.explanation.endsWith(".")).toBe(true);
    }
  });

  it("names the ISO seam types, each with a plain explanation", () => {
    const seams = listSeamClasses();
    expect(seams.map((seam) => seam.iso)).toEqual(["1", "2", "3", "6"]);
    for (const seam of seams) expect(seam.explanation.endsWith(".")).toBe(true);
  });

  it("looks a class up by id, and gives nothing for an unknown id", () => {
    expect(stitchClassById("four-thread-overedge")?.iso).toBe("514");
    expect(seamClassById("superimposed")?.iso).toBe("1");
    expect(stitchClassById("nope")).toBeUndefined();
    expect(seamClassById("nope")).toBeUndefined();
  });

  it("hands out copies, so a caller cannot change the catalogue", () => {
    (listStitchClasses() as unknown[]).length = 0;
    expect(listStitchClasses()).toHaveLength(6);
  });
});

describe("the seams of a top", () => {
  it("gives a crew tee its shoulder, armhole, sleeve, side, neck and hem seams", () => {
    expect(seamIds("crew-tee")).toEqual([
      "shoulder-seam",
      "armhole-seam",
      "sleeve-underarm-seam",
      "side-seam",
      "sleeve-hem",
      "body-hem",
      "neckband-seam",
    ]);
  });

  it("swaps the shoulder and armhole for a raglan seam", () => {
    const ids = seamIds("team-jersey", { "sleeve-type": "raglan" });
    expect(ids).toContain("raglan-seam");
    expect(ids).not.toContain("shoulder-seam");
    expect(ids).not.toContain("armhole-seam");
  });

  it("swaps the sleeve hem for a cuff seam when there are ribbed cuffs", () => {
    const ids = seamIds("long-sleeve-tee", { cuffs: "rib-cuff" });
    expect(ids).toContain("cuff-seam");
    expect(ids).not.toContain("sleeve-hem");
  });

  it("keeps the sleeve hem on a tee that has no cuffs option at all", () => {
    expect(seamIds("crew-tee")).toContain("sleeve-hem");
  });

  it("swaps the side seam for side panel seams", () => {
    const ids = seamIds("team-jersey", { "side-panels": "contrast-insert" });
    expect(ids).toContain("side-panel-seam");
    expect(ids).not.toContain("side-seam");
  });

  it("adds a collar seam, a placket seam and a zip seam only where the design has them", () => {
    const polo = seamIds("polo");
    expect(polo).toContain("collar-seam");
    expect(polo).toContain("placket-seam");
    expect(polo).not.toContain("zip-seam");
    expect(polo).not.toContain("neckband-seam");
    expect(seamIds("polo", { placket: "zip" })).toContain("zip-seam");
  });

  it("adds a seam for side vents", () => {
    expect(seamIds("polo", { "hem-shape": "side-vent" })).toContain("side-vent-seam");
    expect(seamIds("polo")).not.toContain("side-vent-seam");
  });

  it("says which panels a seam joins, by label", () => {
    const shoulder = seamsFor(start("crew-tee")).find((seam) => seam.id === "shoulder-seam");
    expect(shoulder?.label).toBe("Shoulder seam");
    expect(shoulder?.panels.map((panel) => panel.label)).toEqual(["Body front", "Body back"]);
  });

  it("proposes a seam class and a stitch class for each seam, from the registry rule", () => {
    const shoulder = seamsFor(start("crew-tee")).find((seam) => seam.id === "shoulder-seam");
    expect(shoulder?.seamClass.iso).toBe("1");
    expect(shoulder?.stitchClass.iso).toBe("514");
    const hem = seamsFor(start("crew-tee")).find((seam) => seam.id === "body-hem");
    expect(hem?.seamClass.iso).toBe("6");
  });

  it("finds no seams for an unknown type", () => {
    expect(seamsFor({ typeId: "kilt", options: {} })).toEqual([]);
  });

  it("only ever joins panels the design has, for every valid combination of every top", () => {
    let checked = 0;
    for (const type of listTypes("tops")) {
      for (const choices of allCombinations(type.id).filter((entry) => checkCombination(type.id, entry).length === 0)) {
        const shape = { typeId: type.id, options: choices };
        const present = new Set(panelsFor(shape).map((panel) => panel.id));
        const seams = seamsFor(shape);
        expect(seams.length).toBeGreaterThan(4);
        for (const seam of seams) {
          for (const panel of seam.panels) expect(present.has(panel.id)).toBe(true);
        }
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it("gives every panel of every valid combination at least one seam", () => {
    for (const type of listTypes("tops")) {
      for (const choices of allCombinations(type.id).filter((entry) => checkCombination(type.id, entry).length === 0)) {
        const shape = { typeId: type.id, options: choices };
        const joined = new Set(seamsFor(shape).flatMap((seam) => seam.panels.map((panel) => panel.id)));
        for (const panel of panelsFor(shape)) expect(joined.has(panel.id)).toBe(true);
      }
    }
  });

  it("never repeats a seam id", () => {
    const ids = TOPS.seams.map((seam) => seam.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the components a top implies", () => {
  const slotIds = (typeId: string, choices: Record<string, string> = {}): string[] => {
    const base = start(typeId);
    const options = Object.fromEntries(
      Object.entries(choices).map(([id, choiceId]) => [id, { choiceId, provenance: "user-edited" as const }]),
    );
    return componentSlotsFor({ typeId, options: { ...base.options, ...options } }).map((slot) => slot.id);
  };

  it("always implies thread and three labels", () => {
    expect(slotIds("crew-tee")).toEqual(["main-thread", "brand-label", "care-label", "size-label", "rib-neckband"]);
  });

  it("implies buttons for a buttoned placket and a zip for a zipped one", () => {
    expect(slotIds("polo")).toContain("buttons");
    expect(slotIds("polo")).not.toContain("zip");
    expect(slotIds("polo", { placket: "zip" })).toContain("zip");
    expect(slotIds("polo", { placket: "zip" })).not.toContain("buttons");
  });

  it("implies rib for the neckband, the cuffs and the collar only where the design has them", () => {
    expect(slotIds("polo")).toContain("rib-collar");
    expect(slotIds("polo")).not.toContain("rib-neckband");
    expect(slotIds("polo")).not.toContain("rib-cuffs");
    expect(slotIds("polo", { cuffs: "rib-cuff" })).toContain("rib-cuffs");
  });

  it("gives each slot a kind, a label and a plain sentence", () => {
    for (const slot of componentSlotsFor(start("polo"))) {
      expect(["rib", "thread", "label", "trim"]).toContain(slot.kind);
      expect(slot.label.length).toBeGreaterThan(2);
      expect(slot.help.endsWith(".")).toBe(true);
    }
  });

  it("finds no slots for an unknown type", () => {
    expect(componentSlotsFor({ typeId: "kilt", options: {} })).toEqual([]);
  });
});

describe("numbers in the construction data", () => {
  const DIGIT = /\d/;

  /** Every string and number in a value, with the name of the field it sits in. */
  const leaves = (value: unknown, name = ""): { name: string; leaf: unknown }[] => {
    if (Array.isArray(value)) return value.flatMap((item) => leaves(item, name));
    if (typeof value === "object" && value !== null) {
      return Object.entries(value).flatMap(([key, inner]) => leaves(inner, key));
    }
    return [{ name, leaf: value }];
  };

  it("allows digits only in the ISO class numbers of the catalogue", () => {
    const found = leaves([listStitchClasses(), listSeamClasses()]).filter(({ leaf }) => DIGIT.test(String(leaf)));
    expect(found.length).toBeGreaterThan(0);
    for (const { name } of found) expect(name).toBe("iso");
  });

  it("holds no number of any kind in the seams and component slots, which only name classes", () => {
    const found = leaves([TOPS.seams, TOPS.components]).filter(
      ({ leaf }) => typeof leaf === "number" || DIGIT.test(String(leaf)),
    );
    expect(found).toEqual([]);
  });
});
