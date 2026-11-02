import { describe, expect, it, vi } from "vitest";
import { colourLimitOf, colourLimitProblem } from "./limits";
import { colourReadingsPass, COLOUR_RULE_ID, parseColourReadings, readingVerdict, type ColourReading } from "./colour";
import { listColourReadings } from "./service";

const reading = (over: Partial<ColourReading> = {}): ColourReading => ({
  colourName: "Kit navy",
  deltaE: 1.2,
  limitDeltaE: 1.5,
  method: null,
  instrument: null,
  whitePoint: null,
  observer: null,
  ruleId: COLOUR_RULE_ID,
  ...over,
});

describe("parseColourReadings", () => {
  it("reads a colour and its Delta-E per line, and puts the factory's own limit on each", () => {
    const parsed = parseColourReadings("Kit navy, 1.2\nKit red, 0.8", 1.5);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.value).toEqual([reading(), reading({ colourName: "Kit red", deltaE: 0.8 })]);
  });

  it("takes no reading at all from an empty field", () => {
    expect(parseColourReadings("", 1.5)).toEqual({ ok: true, value: [] });
  });

  it("leaves the limit null where the factory has none, so nothing judges the reading", () => {
    const parsed = parseColourReadings("Kit navy, 1.2", null);
    expect(parsed.ok && parsed.value[0]?.limitDeltaE).toBeNull();
  });

  it("says which line it cannot read rather than guessing at it", () => {
    for (const bad of ["Kit navy", "Kit navy, lots", "Kit navy, 1.2, 3", ", 1.2", "Kit navy, 400"]) {
      const parsed = parseColourReadings(bad, 1.5);
      expect(parsed.ok, bad).toBe(false);
      if (!parsed.ok) expect(parsed.problem).toContain("Write: colour, Delta-E reading.");
    }
  });

  it("refuses a colour name over 60 characters and more than 20 readings", () => {
    expect(parseColourReadings(`${"n".repeat(61)}, 1.2`, 1.5).ok).toBe(false);
    const many = Array.from({ length: 21 }, (_, i) => `Colour ${i}, 1.0`).join("\n");
    expect(parseColourReadings(many, 1.5)).toEqual({ ok: false, problem: "Up to 20 colour readings." });
  });
});

describe("readingVerdict", () => {
  it("says a reading is inside the tolerance the factory works to", () => {
    const verdict = readingVerdict(reading());
    expect(verdict.status).toBe("inside");
    expect(verdict.text).toContain("within the 1.5");
  });

  it("says a reading is over it, and names the number", () => {
    const verdict = readingVerdict(reading({ deltaE: 2.1 }));
    expect(verdict.status).toBe("outside");
    expect(verdict.text).toContain("over the 1.5");
  });

  it("says that nothing on file judges a reading with no tolerance", () => {
    const verdict = readingVerdict(reading({ limitDeltaE: null }));
    expect(verdict.status).toBe("no-limit");
    expect(verdict.text).toContain("No colour tolerance is set");
    expect(verdict.ruleId).toBe(COLOUR_RULE_ID);
  });
});

describe("colourReadingsPass", () => {
  it("passes when every reading with a limit is inside it, including at the edge", () => {
    expect(colourReadingsPass([])).toBe(true);
    expect(colourReadingsPass([reading(), reading({ deltaE: 1.5 })])).toBe(true);
  });

  it("fails on one reading over its limit, and never fails on a reading with none", () => {
    expect(colourReadingsPass([reading(), reading({ deltaE: 1.6 })])).toBe(false);
    expect(colourReadingsPass([reading({ deltaE: 99, limitDeltaE: null })])).toBe(true);
  });
});

const fabric = (name: string, delta: number | null) => ({
  name,
  swatchRef: null,
  colourDelta: delta === null ? ({ status: "not-set" } as const) : ({ status: "set", value: delta } as const),
});

describe("colourLimitOf", () => {
  it("takes the tolerance when the factory holds the same one on every fabric it makes", () => {
    expect(colourLimitOf({ fabrics: [fabric("F-POLY-INT interlock", 1.5), fabric("F-POLY-PQ pique", 1.5)] })).toBe(1.5);
    expect(colourLimitProblem({ fabrics: [fabric("F-POLY-INT interlock", 1.5)] })).toBeNull();
  });

  it("takes none, and says why, when a fabric has no tolerance agreed", () => {
    const profile = { fabrics: [fabric("F-POLY-INT interlock", 1.5), fabric("F-STK-TEE stock tee", null)] };
    expect(colourLimitOf(profile)).toBeNull();
    expect(colourLimitProblem(profile)).toContain("F-STK-TEE stock tee");
  });

  it("takes none when the tolerances differ, because nothing says which applies", () => {
    const profile = { fabrics: [fabric("a", 1.5), fabric("b", 2)] };
    expect(colourLimitOf(profile)).toBeNull();
    expect(colourLimitProblem(profile)).toContain("different colour tolerance");
  });

  it("takes none from a factory with no fabric on file", () => {
    expect(colourLimitOf({ fabrics: [] })).toBeNull();
    expect(colourLimitProblem({ fabrics: [] })).toContain("no fabric on file");
  });
});

describe("listColourReadings", () => {
  it("reads an order's readings with what each was judged against", async () => {
    const row = {
      id: "0c2d6d0a-6f43-4a60-9f4e-6a4c3a0a1111",
      inspection_id: "0c2d6d0a-6f43-4a60-9f4e-6a4c3a0a2222",
      colour_name: "Kit navy",
      delta_e: "1.200",
      limit_delta_e: "1.500",
      method: null,
      instrument: null,
      white_point: null,
      observer: null,
      rule_id: COLOUR_RULE_ID,
      at: "2026-12-07T10:00:00Z",
    };
    const limit = vi.fn().mockResolvedValue({ data: [row], error: null });
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit }) }) }) }) }));
    const readings = await listColourReadings({ from } as never, "o");
    expect(readings[0]).toMatchObject({ colourName: "Kit navy", deltaE: 1.2, limitDeltaE: 1.5 });
  });

  it("refuses when the read fails", async () => {
    const from = vi.fn(() => ({ select: () => ({ eq: () => ({ order: () => ({ order: () => ({ limit: () => ({ data: null, error: { message: "raw", hint: "qc_not_passed" } }) }) }) }) }) }));
    await expect(listColourReadings({ from } as never, "o")).rejects.toThrow(/not a pass/);
  });
});
