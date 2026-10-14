import { describe, expect, it } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import type { SizeLabelMap, TeamOrder } from "@/lib/production/contract";
import { cutList } from "./cut-list";
import { DEFAULT_EFFICIENCY, fabricUseFor, fabricUseForSize, type FabricWidth } from "./fabric-use";

const rows = cutList(JERSEY_EU48.piecesBySize["48"]!, { assign: { collar: "rib" } });
const width = (mm: number | null, source: FabricWidth["source"] = "stated-in-request"): FabricWidth => ({ mm, source });

describe("DEFAULT_EFFICIENCY", () => {
  it("is labelled as a default, not from a marker", () => {
    expect(DEFAULT_EFFICIENCY.source).toBe("knitwright-default");
    expect(DEFAULT_EFFICIENCY.label).toBe("Knitwright default, not from a marker");
    expect(DEFAULT_EFFICIENCY.value).toBeGreaterThan(0);
    expect(DEFAULT_EFFICIENCY.value).toBeLessThan(1);
  });
});

describe("fabricUseForSize", () => {
  const uses = fabricUseForSize(rows, { main: width(1600), rib: width(1000, "supplier-sheet") });
  const main = uses.find((u) => u.fabricId === "main")!;

  it("gives one line per fabric, in a stable order", () => {
    expect(uses.map((u) => u.fabricId)).toEqual(["main", "rib"]);
  });

  it("is piece area over usable width times efficiency", () => {
    const area = rows.filter((r) => r.fabricId === "main").reduce((s, r) => s + r.totalAreaCm2, 0) * 100;
    expect(main.lengthMm).toBeCloseTo(area / (1600 * DEFAULT_EFFICIENCY.value), 6);
    expect(main.areaCm2).toBeCloseTo(area / 100, 6);
  });

  it("names every assumption behind the number", () => {
    expect(main.assumptions.join(" ")).toMatch(/160 cm/);
    expect(main.assumptions.join(" ")).toMatch(/Knitwright default, not from a marker/);
    expect(main.assumptions.join(" ")).toMatch(/does not say whether the outline includes the seam allowance/);
  });

  it("says where a width came from", () => {
    expect(main.widthSource).toBe("stated-in-request");
    expect(uses[1]?.widthSource).toBe("supplier-sheet");
  });

  it("gives no length when the fabric has no usable width, and says why", () => {
    const [u] = fabricUseForSize(rows.filter((r) => r.fabricId === "main"), { main: width(null, "not-set") });
    expect(u?.lengthMm).toBeNull();
    expect(u?.assumptions.join(" ")).toMatch(/no usable width/i);
  });

  it("gives no length when the fabric is not listed at all", () => {
    const [u] = fabricUseForSize(rows.filter((r) => r.fabricId === "main"), {});
    expect(u?.lengthMm).toBeNull();
  });

  it("uses a marker's efficiency when one is given", () => {
    const [u] = fabricUseForSize(rows.filter((r) => r.fabricId === "main"), { main: width(1600) }, { value: 0.9, source: "marker", label: "From the factory's marker" });
    expect(u?.efficiency.value).toBe(0.9);
    expect(u?.assumptions.join(" ")).toMatch(/From the factory's marker/);
    expect(u!.lengthMm!).toBeLessThan(main.lengthMm!);
  });

  it("refuses an efficiency outside 0 to 1", () => {
    expect(() => fabricUseForSize(rows, { main: width(1600) }, { value: 1.2, source: "marker", label: "x" })).toThrow();
    expect(() => fabricUseForSize(rows, { main: width(1600) }, { value: 0, source: "marker", label: "x" })).toThrow();
  });

  it("says an outline that holds the allowance, and notes the cut piece is the area counted", () => {
    expect(main.assumptions.join(" ")).toMatch(/whole pieces/i);
  });
});

const map = (label: string, patternSize: string, cut: SizeLabelMap["cut"] = "mens"): SizeLabelMap => ({
  label, wearer: "men", cut, patternSize, source: "suggested",
});
const order = (rowsIn: TeamOrder["rows"]): TeamOrder => ({
  id: "11111111-1111-4111-8111-111111111111",
  projectId: "22222222-2222-4222-8222-222222222222",
  name: "Test",
  rows: rowsIn,
});

describe("fabricUseFor an order", () => {
  const input = (o: TeamOrder) => ({
    order: o,
    pattern: JERSEY_EU48,
    maps: [map("M", "48")],
    assign: { collar: "rib" },
    widths: { main: width(1600), rib: width(1000) },
  });

  it("multiplies one garment's fabric by the number ordered", () => {
    const one = fabricUseFor(input(order([{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 1 }])));
    const ten = fabricUseFor(
      input(order([
        { name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 4 },
        { name: "B", number: "2", sizeLabel: "M", cut: "mens", quantity: 6 },
      ])),
    );
    const main1 = one.fabrics.find((f) => f.fabricId === "main")!;
    const main10 = ten.fabrics.find((f) => f.fabricId === "main")!;
    expect(main10.lengthMm!).toBeCloseTo(main1.lengthMm! * 10, 6);
    expect(ten.garments).toBe(10);
    expect(ten.problems).toEqual([]);
  });

  it("breaks the total down by size", () => {
    const r = fabricUseFor(input(order([{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 3 }])));
    expect(r.bySize).toHaveLength(1);
    expect(r.bySize[0]).toMatchObject({ sizeLabel: "M", cut: "mens", patternSize: "48", garments: 3 });
  });

  it("reports a size with no pattern size in the map, and leaves it out of the total", () => {
    const r = fabricUseFor(input(order([{ name: "A", number: "1", sizeLabel: "4XL", cut: "mens", quantity: 2 }])));
    expect(r.problems[0]).toMatch(/4XL.*no pattern size/i);
    expect(r.garments).toBe(0);
  });

  it("reports a pattern size the pattern does not have", () => {
    const r = fabricUseFor({ ...input(order([{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 2 }])), maps: [map("M", "99")] });
    expect(r.problems[0]).toMatch(/pattern size 99/i);
  });

  it("reports a fabric without a width", () => {
    const r = fabricUseFor({ ...input(order([{ name: "A", number: "1", sizeLabel: "M", cut: "mens", quantity: 2 }])), widths: { main: width(1600) } });
    expect(r.fabrics.find((f) => f.fabricId === "rib")?.lengthMm).toBeNull();
  });
});
