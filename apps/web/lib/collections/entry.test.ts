import { describe, expect, it } from "vitest";
import { minorFrom, minorText, parseSizes, sizesText, splitFrom } from "./entry";

/**
 * Decision 0085: what the founder types, read into the shapes the plan holds. Money is kept in integer
 * minor units, so nothing a form takes can become a float, and a figure that cannot be read is said to
 * be unreadable rather than guessed at.
 */

describe("parseSizes", () => {
  it("reads pieces per size from one line", () => {
    expect(parseSizes("S:10, M:20, L:5").sizes).toEqual({ S: 10, M: 20, L: 5 });
  });

  it("keeps a size planned at zero, because a plan may hold one", () => {
    expect(parseSizes("S:0").sizes).toEqual({ S: 0 });
  });

  it("reads nothing from an empty field, and finds nothing wrong with it", () => {
    expect(parseSizes("   ")).toEqual({ sizes: {}, findings: [] });
  });

  it("says which parts could not be read, and reads the rest", () => {
    const parsed = parseSizes("S:ten, M:20, :4, L");
    expect(parsed.sizes).toEqual({ M: 20 });
    expect(parsed.findings[0]).toMatchObject({ code: "sizes_unreadable", severity: "blocker", ruleId: "R-GAP-000" });
    expect(parsed.findings[0]!.message).toContain("S:ten");
  });

  it("refuses a size label longer than the database allows, and a wild quantity", () => {
    expect(parseSizes("ThisLabelIsFarTooLong:4").sizes).toEqual({});
    expect(parseSizes("M:1000000").sizes).toEqual({});
    expect(parseSizes("M:-2").sizes).toEqual({});
    expect(parseSizes("M:2.5").sizes).toEqual({});
  });

  it("writes the saved sizes back into the field's own shape", () => {
    expect(sizesText([{ label: "S", qty: 10 }, { label: "M", qty: 20 }])).toBe("S:10, M:20");
    expect(parseSizes(sizesText([{ label: "S", qty: 10 }])).sizes).toEqual({ S: 10 });
  });
});

describe("money", () => {
  it("reads pounds into whole minor units", () => {
    expect([minorFrom("29"), minorFrom("29.5"), minorFrom("29.50"), minorFrom("0.07")]).toEqual([2900, 2950, 2950, 7]);
  });

  it("reads a comma as a decimal point", () => {
    expect(minorFrom("29,50")).toBe(2950);
  });

  it("treats an empty field as not set, never as zero", () => {
    expect(minorFrom("  ")).toBeNull();
    expect(minorText(null)).toBe("");
  });

  it("refuses anything that is not money", () => {
    for (const text of ["twenty", "29.555", "-5", "1e3", "29.5.5"]) expect(minorFrom(text), text).toBe("unreadable");
  });

  it("writes minor units back out for a form", () => {
    expect([minorText(2900), minorText(2950), minorText(7)]).toEqual(["29.00", "29.50", "0.07"]);
  });
});

describe("the wholesale split", () => {
  it("reads a percentage into basis points", () => {
    expect([splitFrom("60"), splitFrom("0"), splitFrom("100"), splitFrom("12.5")]).toEqual([6000, 0, 10_000, 1250]);
  });

  it("refuses a split outside nought to a hundred, and anything that is not a number", () => {
    for (const text of ["-1", "101", "half"]) expect(splitFrom(text), text).toBe("unreadable");
  });
});
