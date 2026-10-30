import { describe, expect, it } from "vitest";
import { benchmarkCardSchema, emptyCard, MEASURED_FIELDS } from "./schema";
import { card, runningShort } from "./fixtures/cards";

/** The fixed schema and its provenance rules (spec F-S2 steps 3 and 4). */

const parse = (parts: Record<string, unknown>) => benchmarkCardSchema.safeParse({ ...emptyCard(), ...parts });

describe("every field says how it is known", () => {
  it("refuses a value that does not say how it is known", () => {
    expect(parse({ fit: { value: "Slim", provenance: "unknown" } }).success).toBe(false);
    expect(parse({ fit: { value: null, provenance: "observed" } }).success).toBe(false);
    expect(parse({ fit: { value: "Slim", provenance: "guessed" } }).success).toBe(false);
  });

  it("takes observed, inferred and unknown, and nothing else", () => {
    expect(parse({ fit: { value: "Slim", provenance: "observed" } }).success).toBe(true);
    expect(parse({ fit: { value: "Slim", provenance: "inferred" } }).success).toBe(true);
    expect(emptyCard().fit).toEqual({ value: null, provenance: "unknown", corrected: false });
  });
});

describe("a measurement is stated or not known", () => {
  it("refuses an inferred price or GSM, because that would be an invented measurement", () => {
    expect(parse({ price: { value: { minor: 4500, currency: "GBP" }, provenance: "inferred" } }).success).toBe(false);
    expect(parse({ gsm: { value: 140, provenance: "inferred" } }).success).toBe(false);
  });

  it("takes a stated price in minor units with a currency, and a stated GSM", () => {
    expect(parse({ price: { value: { minor: 4500, currency: "GBP" }, provenance: "observed" } }).success).toBe(true);
    expect(parse({ gsm: { value: 140, provenance: "observed" } }).success).toBe(true);
    expect(parse({ price: { value: { minor: 45, currency: "pounds" }, provenance: "observed" } }).success).toBe(false);
    expect(parse({ gsm: { value: 4, provenance: "observed" } }).success).toBe(false);
  });

  it("names the fields that rule covers", () => {
    expect([...MEASURED_FIELDS]).toEqual(["price", "gsm"]);
  });
});

describe("nothing out of a page's source, and nothing long", () => {
  it("refuses markup in any string", () => {
    expect(parse({ productName: { value: "<b>Speedshort</b>", provenance: "observed" } }).success).toBe(false);
    expect(parse({ complaintThemes: [{ theme: "<script>alert(1)</script>", count: 2 }] }).success).toBe(false);
  });

  it("refuses a theme longer than a short paraphrase and an over-long name", () => {
    expect(parse({ complaintThemes: [{ theme: "x".repeat(161), count: 1 }] }).success).toBe(false);
    expect(parse({ productName: { value: "x".repeat(121), provenance: "observed" } }).success).toBe(false);
  });

  it("refuses a field the schema does not know", () => {
    expect(benchmarkCardSchema.safeParse({ ...emptyCard(), pageHtml: "<html></html>" }).success).toBe(false);
  });
});

describe("lists", () => {
  it("lists a feature once and a zone's kind once", () => {
    expect(parse({ features: [{ key: "drop_tail", provenance: "observed" }, { key: "drop_tail", provenance: "inferred" }] }).success).toBe(false);
    expect(
      parse({
        surfaceLayout: [
          { zone: "sleeve", kind: "stripe", provenance: "inferred" },
          { zone: "sleeve", kind: "stripe", provenance: "observed" },
        ],
      }).success,
    ).toBe(false);
  });

  it("refuses a feature key that is not in the taxonomy", () => {
    expect(parse({ features: [{ key: "welded_zip", provenance: "observed" }] }).success).toBe(false);
  });

  it("round-trips a fully read card", () => {
    const read = runningShort();
    expect(benchmarkCardSchema.parse(read)).toEqual(read);
    expect(card().features).toEqual([]);
  });
});
