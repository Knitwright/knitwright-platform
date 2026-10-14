import { describe, expect, it } from "vitest";
import { hasErrors } from "./checks";
import { importBody, manifestQuery, orderBody, rosterRowInput } from "./schemas";

const row = { name: "  OKAFOR ", number: " 7 ", sizeLabel: " M ", cut: "mens", quantity: 1 };

describe("rosterRowInput", () => {
  it("cleans what was typed", () => {
    expect(rosterRowInput.parse(row)).toEqual({ name: "OKAFOR", number: "7", sizeLabel: "M", cut: "mens", quantity: 1 });
  });
  it("refuses a name with a formula, with the reason", () => {
    const result = rosterRowInput.safeParse({ ...row, name: "=CMD()" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain("letters");
  });
  it("refuses a number that is not 1 to 3 digits, and an empty size", () => {
    expect(rosterRowInput.safeParse({ ...row, number: "1000" }).success).toBe(false);
    expect(rosterRowInput.safeParse({ ...row, sizeLabel: " " }).success).toBe(false);
  });
});

describe("orderBody", () => {
  it("needs a name and at least one player", () => {
    expect(orderBody.safeParse({ name: "T", rows: [] }).success).toBe(false);
    expect(orderBody.safeParse({ name: " ", rows: [row] }).success).toBe(false);
    expect(orderBody.parse({ name: " Round 1 ", rows: [row] }).name).toBe("Round 1");
  });
});

describe("importBody and manifestQuery", () => {
  it("takes csv text with an optional mapping", () => {
    expect(importBody.safeParse({ csv: "a", mapping: { number: 1, sizeLabel: 2 }, header: false, defaultCut: "mens" }).success).toBe(true);
    expect(importBody.safeParse({ csv: "" }).success).toBe(false);
    expect(importBody.safeParse({ csv: "a", mapping: { number: -1 } }).success).toBe(false);
  });
  it("takes one of three formats", () => {
    expect(manifestQuery.safeParse({ format: "pdf" }).success).toBe(true);
    expect(manifestQuery.safeParse({ format: "svg" }).success).toBe(false);
  });
});

describe("hasErrors", () => {
  it("is true only for an error", () => {
    expect(hasErrors([{ row: 1, severity: "warning", code: "name-not-printed", message: "m" }])).toBe(false);
    expect(hasErrors([{ row: 1, severity: "error", code: "empty", message: "m" }])).toBe(true);
  });
});
