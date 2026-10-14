import { describe, expect, it } from "vitest";
import { cleanName, csvCell, csvLine, escapeXml, NAME_PROBLEM } from "./text";

describe("csvCell", () => {
  it("leaves plain text alone", () => {
    expect(csvCell("OKAFOR")).toBe("OKAFOR");
  });
  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell('A,"B"')).toBe('"A,""B"""');
    expect(csvCell("a\nb")).toBe('"a\nb"');
  });
  it.each(["=SUM(A1)", "+1", "-1", "@cmd", "\tx", "\rx"])("defuses a cell that starts with %j", (raw) => {
    expect(csvCell(raw).replace(/^"/, "").startsWith("'")).toBe(true);
  });
  it("defuses a formula behind a quote too", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
  });
});

describe("csvLine", () => {
  it("joins cells with commas and ends the line with a carriage return and line feed", () => {
    expect(csvLine(["a", "b,c"])).toBe('a,"b,c"\r\n');
  });
});

describe("escapeXml", () => {
  it("escapes the five characters that matter", () => {
    expect(escapeXml(`<a href="x">&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&amp;&apos;&lt;/a&gt;");
  });
});

describe("cleanName", () => {
  it("trims, joins runs of spaces and keeps letters from any script", () => {
    expect(cleanName("  de   la  Cruz ")).toEqual({ ok: true, name: "de la Cruz" });
    expect(cleanName("ŁUKASZ")).toEqual({ ok: true, name: "ŁUKASZ" });
    expect(cleanName("O'BRIEN-SMITH Jr.")).toEqual({ ok: true, name: "O'BRIEN-SMITH Jr." });
  });
  it("allows an empty name", () => {
    expect(cleanName("   ")).toEqual({ ok: true, name: "" });
  });
  it("puts accents in one form", () => {
    expect(cleanName("José")).toEqual({ ok: true, name: "José" });
  });
  it("drops hidden control and direction characters", () => {
    expect(cleanName("AB‮CD​")).toEqual({ ok: true, name: "ABCD" });
    expect(cleanName("A\u0000B")).toEqual({ ok: true, name: "AB" });
  });
  it.each(["=1+1", "<script>", "A;B", 'say "hi"', "x|y", "a\\b", "{x}"])("refuses %j", (raw) => {
    expect(cleanName(raw)).toEqual({ ok: false, message: NAME_PROBLEM });
  });
  it("refuses a name longer than 40 characters", () => {
    expect(cleanName("A".repeat(41)).ok).toBe(false);
  });
});
