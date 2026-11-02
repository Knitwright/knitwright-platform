import { describe, expect, it } from "vitest";
import { CHECKLIST_ITEM_IDS, CHECKLIST_SOURCES, CHECKLIST_TITLES, GAP_RULE_ID, blocker, listOf, warning } from "./model";
import { tbcPathsOf } from "./subject";

describe("tbcPathsOf", () => {
  it("finds [TBC] in a string, however it is written", () => {
    expect(tbcPathsOf("holds [TBC] here", "a")).toEqual(["a"]);
    expect(tbcPathsOf("holds [tbc] here", "a")).toEqual(["a"]);
    expect(tbcPathsOf("To be confirmed", "a")).toEqual([]);
  });

  it("walks arrays and objects, and names the path", () => {
    expect(tbcPathsOf({ bom: [{ spec: "x" }, { spec: "[TBC]" }] })).toEqual(["bom[1].spec"]);
  });

  it("reads keys in a fixed order, so the list never changes between runs", () => {
    expect(tbcPathsOf({ z: "[TBC]", a: "[TBC]" })).toEqual(["a", "z"]);
  });

  it("ignores numbers, booleans, null and undefined", () => {
    expect(tbcPathsOf({ n: 7, b: true, u: null, v: undefined })).toEqual([]);
  });
});

describe("the vocabulary", () => {
  it("gives every item of the checklist a title", () => {
    for (const id of CHECKLIST_ITEM_IDS) expect(CHECKLIST_TITLES[id].length).toBeGreaterThan(0);
    expect(Object.keys(CHECKLIST_TITLES).sort()).toEqual([...CHECKLIST_ITEM_IDS].sort());
  });

  it("names the three places the one checklist is used", () => {
    expect([...CHECKLIST_SOURCES]).toEqual(["techpack", "package", "order"]);
  });

  it("falls back to the gap rule where no entry explains a finding", () => {
    expect(blocker("x", "a", "A sentence.")).toEqual({ code: "x", severity: "blocker", message: "A sentence.", ruleId: GAP_RULE_ID, path: "a" });
    expect(warning("x", "a", "A sentence.", "R-LAB-002").ruleId).toBe("R-LAB-002");
  });

  it("joins words the way the rest of the platform does", () => {
    expect(listOf([])).toBe("");
    expect(listOf(["one"])).toBe("one");
    expect(listOf(["one", "two"])).toBe("one and two");
    expect(listOf(["one", "two", "three"])).toBe("one, two and three");
  });
});
