import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isOffered } from "@/lib/config/launch-garments";
import { chartCompleteness } from "@/lib/sizing/completeness";
import { garmentTypeGroups } from "@/lib/projects/type-groups";
import { checkCombination } from "../../combinations";
import { componentSlotsFor } from "../../construction";
import { createSpec } from "../../spec";
import { checkFamilyData, getType, listFamilies, listTypes } from "../index";
import { CRICKET, FOOTBALL, TEAMWEAR_FAMILIES, TEAMWEAR_TYPE_IDS, WINTER_CODE } from "./index";

const FOOTBALL_IDS = ["football-shirt", "goalkeeper-shirt", "football-shorts", "football-socks", "football-training-top"];
const CRICKET_IDS = ["cricket-shirt", "cricket-trousers", "cricket-training-tee", "cricket-cap"];

describe("the teamwear families", () => {
  it("are football, cricket and one Australian winter code, each sound", () => {
    expect(TEAMWEAR_FAMILIES.map((family) => family.id)).toEqual(["football", "cricket", "winter-code"]);
    for (const family of TEAMWEAR_FAMILIES) expect(checkFamilyData(family)).toEqual([]);
    expect(FOOTBALL.types.map((type) => type.id)).toEqual(FOOTBALL_IDS);
    expect(CRICKET.types.map((type) => type.id)).toEqual(CRICKET_IDS);
    expect(WINTER_CODE.types.map((type) => type.id)).toEqual(["winter-code-top"]);
    expect(TEAMWEAR_TYPE_IDS).toEqual([...FOOTBALL_IDS, ...CRICKET_IDS, "winter-code-top"]);
  });

  it("are in the registry under a label a person reads as the sport", () => {
    const labels = Object.fromEntries(listFamilies().map((family) => [family.id, family.label]));
    expect(labels.football).toBe("Football");
    expect(labels.cricket).toBe("Cricket");
    expect(labels["winter-code"]).toBe("Winter code (Australia)");
    expect(listTypes("football")).toHaveLength(5);
  });

  it("start a valid design of every article for every wearer", () => {
    for (const id of TEAMWEAR_TYPE_IDS) {
      for (const wearer of getType(id)?.wearers ?? []) expect(createSpec(id, wearer).ok, `${id} ${wearer}`).toBe(true);
    }
  });
});

describe("the winter code article", () => {
  it("has a sport option with no code in it until the owner picks one", () => {
    const option = getType("winter-code-top")?.options.find((entry) => entry.id === "winter-code");
    expect(option?.choices.map((choice) => choice.id)).toEqual(["not-chosen"]);
    expect(option?.choices[0]?.label).toMatch(/not chosen/i);
    expect(JSON.stringify(WINTER_CODE).toLowerCase()).not.toMatch(/afl|league|union|netball/);
  });

  it("is called the team top for the winter code", () => {
    expect(getType("winter-code-top")?.label).toBe("Team top, winter code");
  });
});

describe("the goalkeeper shirt", () => {
  it("starts long sleeved and offers padded elbows only with a long sleeve", () => {
    const type = getType("goalkeeper-shirt");
    expect(type?.options.find((entry) => entry.id === "sleeve-length")?.defaultChoice).toBe("long");
    expect(type?.options.find((entry) => entry.id === "elbow-pads")?.choices.map((choice) => choice.id)).toEqual(["none", "padded-elbows"]);
    const base = { "elbow-pads": "padded-elbows" };
    expect(checkCombination("goalkeeper-shirt", { ...base, "sleeve-length": "short" }).map((rule) => rule.ruleId)).toEqual(["padded-elbows-need-long-sleeve"]);
    expect(checkCombination("goalkeeper-shirt", { ...base, "sleeve-length": "long" })).toEqual([]);
  });

  it("lists elbow padding as a part to describe when padded elbows are chosen", () => {
    const slots = (pads: string) => componentSlotsFor({ typeId: "goalkeeper-shirt", options: { "elbow-pads": pads, "sleeve-length": "long" } }).map((slot) => slot.id);
    expect(slots("padded-elbows")).toContain("elbow-padding");
    expect(slots("none")).not.toContain("elbow-padding");
  });
});

describe("socks", () => {
  it("say plainly that they are knitted and that no factory programme was supplied", () => {
    const slots = componentSlotsFor({ typeId: "football-socks", options: { "sock-height": "knee-high", "sock-top": "plain" } });
    const programme = slots.find((slot) => slot.id === "knit-programme");
    expect(programme?.label).toMatch(/not supplied/i);
    expect(programme?.help).toMatch(/knitted/i);
  });

  it("have a foot length and a calf width to measure", () => {
    const ids = getType("football-socks")?.pointsOfMeasure.map((point) => point.id) ?? [];
    expect(ids).toEqual(expect.arrayContaining(["foot-length", "calf-width"]));
  });
});

describe("the cricket cap", () => {
  it("is a cap with a crown, a peak and a band", () => {
    expect(getType("cricket-cap")?.panels.map((panel) => panel.id)).toEqual(["cap-crown", "cap-peak", "cap-band"]);
  });
});

describe("sizes", () => {
  it("never invent a number: no article has a starter chart yet, so every measurement is not set", () => {
    const entries = chartCompleteness().entries.filter((entry) => TEAMWEAR_TYPE_IDS.includes(entry.typeId));
    expect(entries.length).toBe(TEAMWEAR_TYPE_IDS.length * 3);
    for (const entry of entries) expect(entry.hasChart, entry.typeId).toBe(false);
  });
});

describe("the new design start screen", () => {
  it("lists every article under its sport", () => {
    const groups = Object.fromEntries(garmentTypeGroups().map((group) => [group.label, group.options.map((option) => option.id)]));
    expect(groups.Football).toEqual(FOOTBALL_IDS);
    expect(groups.Cricket).toEqual(CRICKET_IDS);
    expect(groups["Winter code (Australia)"]).toEqual(["winter-code-top"]);
    for (const id of TEAMWEAR_TYPE_IDS) expect(isOffered(id)).toBe(true);
  });
});

describe("the owner questions file", () => {
  const path = new URL("./OWNER-QUESTIONS.md", import.meta.url);

  it("exists and asks the four questions the plan names", () => {
    expect(existsSync(path)).toBe(true);
    const text = readFileSync(path, "utf8");
    expect(text).toMatch(/winter code/i);
    expect(text).toMatch(/sock/i);
    expect(text).toMatch(/goalkeeper/i);
    expect(text).toMatch(/cricket cap/i);
  });
});
