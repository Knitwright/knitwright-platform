import { describe, expect, it } from "vitest";
import { manifestFileName } from "./file-name";

describe("manifestFileName", () => {
  it("keeps safe characters and joins the rest with hyphens", () => {
    expect(manifestFileName("Under 12s / Round 1", "csv")).toBe("Under-12s-Round-1.csv");
  });
  it("falls back when nothing is left", () => {
    expect(manifestFileName("日本語", "pdf")).toBe("team-order.pdf");
  });
  it("never holds a path, a quote or a line break", () => {
    expect(manifestFileName('../a"b\r\nc', "csv")).toBe("a-b-c.csv");
  });
});
