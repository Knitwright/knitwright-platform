import { describe, expect, it } from "vitest";
import { ROSTER_22 } from "@/lib/production/fixtures";
import type { RosterRow } from "@/lib/production/contract";
import { checkRoster } from "./checks";

const RUN = ["S", "M", "L", "XL", "2XL", "3XL"];
const row = (over: Partial<RosterRow> = {}): RosterRow => ({ name: "OKAFOR", number: "7", sizeLabel: "M", cut: "mens", quantity: 1, ...over });
const codes = (rows: readonly RosterRow[], over: Partial<Parameters<typeof checkRoster>[1]> = {}) =>
  checkRoster(rows, { run: RUN, hasNamePlace: true, ...over }).map((i) => `${i.row}:${i.code}`);

describe("checkRoster", () => {
  it("finds nothing wrong with the sample team", () => {
    expect(checkRoster(ROSTER_22.rows, { run: RUN, hasNamePlace: true })).toEqual([]);
  });
  it("flags a size that is not in the run, naming the sizes that are", () => {
    const [issue] = checkRoster([row({ sizeLabel: "4XL" })], { run: RUN, hasNamePlace: true });
    expect(issue).toMatchObject({ row: 1, code: "size-not-in-run", severity: "error" });
    expect(issue?.message).toContain("S, M, L, XL, 2XL, 3XL");
  });
  it("flags every row that shares a number", () => {
    expect(codes([row({ number: "10" }), row({ name: "B", number: "11" }), row({ name: "C", number: "10" })])).toEqual([
      "1:duplicate-number",
      "3:duplicate-number",
    ]);
  });
  it("treats 07 and 7 as the same number", () => {
    expect(codes([row({ number: "07" }), row({ name: "B", number: "7" })])).toEqual(["1:duplicate-number", "2:duplicate-number"]);
  });
  it("needs a name when the design has a name place", () => {
    expect(codes([row({ name: "" })])).toEqual(["1:missing-name"]);
  });
  it("allows an empty name when the design has no name place", () => {
    expect(codes([row({ name: "" })], { hasNamePlace: false })).toEqual([]);
  });
  it("warns that a name will not print when the design has no name place", () => {
    const issues = checkRoster([row()], { run: RUN, hasNamePlace: false });
    expect(issues).toEqual([expect.objectContaining({ code: "name-not-printed", severity: "warning" })]);
  });
  it("warns when a numbered player has more than one shirt", () => {
    expect(checkRoster([row({ quantity: 2 })], { run: RUN, hasNamePlace: true })).toEqual([
      expect.objectContaining({ code: "several-shirts-one-number", severity: "warning" }),
    ]);
  });
  it("allows any size when the design has no run yet, and says so once", () => {
    expect(checkRoster([row({ sizeLabel: "ZZ" })], { run: [], hasNamePlace: true })).toEqual([
      expect.objectContaining({ row: 0, code: "no-size-run", severity: "warning" }),
    ]);
  });
  it("reports an empty list", () => {
    expect(codes([])).toEqual(["0:empty"]);
  });
});
