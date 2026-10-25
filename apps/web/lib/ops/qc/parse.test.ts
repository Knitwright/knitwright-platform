import { describe, expect, it } from "vitest";
import { parseFileIds, parseMeasurements, parseSizes } from "./parse";

describe("parseMeasurements", () => {
  it("reads one measurement per line, or per semicolon", () => {
    expect(parseMeasurements("Chest width, 520, 522, 5\nLength, 700.5, 699, 6; Sleeve, 210, 210, 0")).toEqual({
      ok: true,
      value: [
        { point: "Chest width", specMm: 520, measuredMm: 522, toleranceMm: 5 },
        { point: "Length", specMm: 700.5, measuredMm: 699, toleranceMm: 6 },
        { point: "Sleeve", specMm: 210, measuredMm: 210, toleranceMm: 0 },
      ],
    });
  });

  it("is empty for empty text, and the caller decides what that means", () => {
    expect(parseMeasurements("  \n ")).toEqual({ ok: true, value: [] });
  });

  it.each(["Chest, 520, 522", "Chest, abc, 1, 1", "Chest, 520, -1, 1", "Chest, 0, 1, 1", ", 1, 1, 1", "Chest, 1.2345, 1, 1", "Chest, 1, 1, 1, 1"])(
    "refuses %j and says which line",
    (line) => {
      const out = parseMeasurements(line);
      expect(out.ok).toBe(false);
      expect(out.ok === false && out.problem).toContain("Cannot read");
    },
  );

  it("refuses more than 60", () => {
    const text = Array.from({ length: 61 }, (_, i) => `P${i}, 1, 1, 1`).join("\n");
    expect(parseMeasurements(text)).toEqual({ ok: false, problem: "Up to 60 measurements." });
  });
});

describe("parseSizes", () => {
  it("reads several spellings and adds a repeated size", () => {
    expect(parseSizes("M 2, L x1; XL:3\nM 1")).toEqual({ ok: true, value: { M: 3, L: 1, XL: 3 } });
  });

  it.each(["", "M", "M 0", "M two", "M 1.5"])("refuses %j", (text) => {
    expect(parseSizes(text).ok).toBe(false);
  });

  it("refuses more than 40 sizes", () => {
    expect(parseSizes(Array.from({ length: 41 }, (_, i) => `S${i} 1`).join(",")).ok).toBe(false);
  });
});

describe("parseFileIds", () => {
  const a = "6f1c0a52-0a3e-4a39-8f0b-2f5d8f3c9a11";
  it("reads ids separated by anything, once each", () => {
    expect(parseFileIds(`${a}, ${a.toUpperCase()}\n`)).toEqual({ ok: true, value: [a] });
    expect(parseFileIds("")).toEqual({ ok: true, value: [] });
  });
  it("refuses what is not an id and more than 20", () => {
    expect(parseFileIds("photo.jpg").ok).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => `6f1c0a52-0a3e-4a39-8f0b-${String(i).padStart(12, "0")}`).join(" ");
    expect(parseFileIds(many).ok).toBe(false);
  });
});
