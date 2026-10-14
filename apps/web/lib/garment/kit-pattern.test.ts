import { describe, expect, it } from "vitest";
import { applyAction, createSpec, garmentSpecSchema, garmentSpecStructureSchema, type GarmentSpec } from "./index";
import {
  KIT_PATTERN_LABELS,
  KIT_PATTERN_STYLES,
  describeKitPattern,
  kitPatternFits,
  kitPatternSchema,
  withoutKitPattern,
  type KitPattern,
} from "./kit-pattern";

function spec(typeId: string): GarmentSpec {
  const made = createSpec(typeId, "men");
  if (!made.ok) throw new Error(made.reason);
  return made.spec;
}

const hoops: KitPattern = {
  style: "hoops",
  colours: [{ colour: "Gold", swatch: "#d4af37" }],
  size: 800,
  provenance: "user-edited",
};

describe("the kit pattern of a design", () => {
  it("has a plain label for every style", () => {
    for (const style of KIT_PATTERN_STYLES) expect(KIT_PATTERN_LABELS[style]).toMatch(/^[A-Z]/);
  });

  it("is optional, so a design saved before it existed still reads", () => {
    const old = spec("team-jersey");
    expect(Object.hasOwn(old, "kitPattern")).toBe(false);
    expect(garmentSpecStructureSchema.safeParse(old).success).toBe(true);
  });

  it("is set and removed by actions, and the design stays valid", () => {
    const set = applyAction(spec("team-jersey"), { type: "set-kit-pattern", kitPattern: hoops });
    expect(set.ok && set.spec.kitPattern).toEqual(hoops);
    if (!set.ok) return;
    expect(garmentSpecSchema.safeParse(set.spec).success).toBe(true);
    const removed = applyAction(set.spec, { type: "remove-kit-pattern" });
    expect(removed.ok && Object.hasOwn(removed.spec, "kitPattern")).toBe(false);
  });

  it("refuses to remove a pattern the design does not have", () => {
    const removed = applyAction(spec("polo"), { type: "remove-kit-pattern" });
    expect(removed).toEqual({ ok: false, reason: "There is no kit pattern to remove." });
  });

  it("goes only on tops, and says why not elsewhere", () => {
    expect(kitPatternFits(spec("polo").typeId)).toBe(true);
    expect(kitPatternFits("shorts")).toBe(false);
    const refused = applyAction(spec("shorts"), { type: "set-kit-pattern", kitPattern: hoops });
    expect(refused.ok).toBe(false);
    expect(!refused.ok && refused.reason).toMatch(/Kit patterns are drawn on tops only/);
  });

  it("is dropped, and reported, when the garment becomes one that cannot carry it", () => {
    const set = applyAction(spec("team-jersey"), { type: "set-kit-pattern", kitPattern: hoops });
    if (!set.ok) throw new Error(set.reason);
    const kept = applyAction(set.spec, { type: "change-type", typeId: "polo" });
    expect(kept.ok && kept.spec.kitPattern).toEqual(hoops);
    const moved = applyAction(set.spec, { type: "change-type", typeId: "joggers" });
    if (!moved.ok) throw new Error(moved.reason);
    expect(Object.hasOwn(moved.spec, "kitPattern")).toBe(false);
    expect(moved.dropped.some((entry) => entry.kind === "kit-pattern" && /Hoops/.test(entry.message))).toBe(true);
  });

  it("needs at least one colour, each with a name or a swatch, and at most two", () => {
    expect(kitPatternSchema.safeParse({ ...hoops, colours: [] }).success).toBe(false);
    expect(kitPatternSchema.safeParse({ ...hoops, colours: [{ colour: "" }] }).success).toBe(false);
    expect(kitPatternSchema.safeParse({ ...hoops, colours: [{ colour: "", swatch: "#ffffff" }] }).success).toBe(true);
    const three = [{ colour: "A" }, { colour: "B" }, { colour: "C" }];
    expect(kitPatternSchema.safeParse({ ...hoops, colours: three }).success).toBe(false);
    expect(kitPatternSchema.safeParse({ ...hoops, size: 0 }).success).toBe(false);
    expect(kitPatternSchema.safeParse({ ...hoops, style: "tartan" }).success).toBe(false);
  });

  it("removes the key, as on a design that never had one", () => {
    const set = { ...spec("polo"), kitPattern: hoops };
    expect(Object.hasOwn(withoutKitPattern(set), "kitPattern")).toBe(false);
  });
});

describe("describing a kit pattern for a factory", () => {
  it("names the style, the colours with their swatches, the band size and where it goes", () => {
    expect(describeKitPattern(hoops)).toBe("Hoops in Gold (#d4af37) over the body colour, bands 8.0 cm, on the front and back of the body.");
  });

  it("joins two colours, and leaves the size out when nobody gave one", () => {
    const sash: KitPattern = {
      style: "sash",
      colours: [{ colour: "Red" }, { colour: "", swatch: "#ffffff" }],
      provenance: "ai-suggested",
    };
    expect(describeKitPattern(sash)).toBe("Sash in Red and screen colour #ffffff over the body colour, on the front and back of the body.");
  });

  it("says a fade is printed as a gradient", () => {
    const fade: KitPattern = { style: "fade", colours: [{ colour: "Navy" }], provenance: "user-edited" };
    expect(describeKitPattern(fade)).toMatch(/^Fade, a printed gradient from the body colour into Navy/);
  });
});

describe("polka dots", () => {
  const dots: KitPattern = {
    style: "dots",
    colours: [{ colour: "Red", swatch: "#c8102e" }, { colour: "Royal blue", swatch: "#1f4fbf" }],
    size: 300,
    dots: { pitch: 700, rowStep: 350, halfDrop: true, clearSpace: 100 },
    provenance: "user-edited",
  };

  it("takes the benchmark jersey's numbers", () => {
    expect(kitPatternSchema.safeParse(dots).success).toBe(true);
  });

  it("refuses dot spacing on any other style, and dots wider than their pitch", () => {
    expect(kitPatternSchema.safeParse({ ...hoops, dots: { pitch: 700 } }).success).toBe(false);
    expect(kitPatternSchema.safeParse({ ...dots, size: 800 }).success).toBe(false);
  });

  it("says the spacing in plain words", () => {
    expect(describeKitPattern(dots)).toBe(
      "Polka dots in Red (#c8102e) and Royal blue (#1f4fbf) over the body colour, dots 3.0 cm, centres 7.0 cm, rows 3.5 cm, every other row shifted half a step, colour changes row by row, 1.0 cm clear around names, numbers and marks, on the front and back of the body.",
    );
  });

  it("says a spacing nobody gave is to be confirmed", () => {
    const bare: KitPattern = { style: "dots", colours: [{ colour: "Red" }], provenance: "user-edited" };
    expect(describeKitPattern(bare)).toContain("dots to be confirmed, centres to be confirmed, rows to be confirmed");
  });
});

describe("polka dot spacing limits", () => {
  it("refuses a pitch or row step under 5 mm", () => {
    const base: KitPattern = { style: "dots", colours: [{ colour: "Red" }], provenance: "user-edited" };
    expect(kitPatternSchema.safeParse({ ...base, dots: { pitch: 10 } }).success).toBe(false);
    expect(kitPatternSchema.safeParse({ ...base, dots: { rowStep: 10 } }).success).toBe(false);
  });
});
