import { describe, expect, it, vi } from "vitest";
import { DEFAULT_GARMENT_UNIT, garmentUnitFrom, readLengthUnit, saveLengthUnit, toCmOrIn, unitSummary } from "./preference";

const reading = (data: unknown, error: unknown = null) =>
  ({ from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data, error }) }) }) }) }) as never;

describe("the garment unit", () => {
  it("is millimetres unless a person chose otherwise", () => {
    expect(DEFAULT_GARMENT_UNIT).toBe("mm");
    expect(garmentUnitFrom("cm")).toBe("cm");
    expect(garmentUnitFrom("in")).toBe("in");
    expect(garmentUnitFrom("ft")).toBe("mm");
    expect(garmentUnitFrom(undefined)).toBe("mm");
  });

  it("reads millimetres as centimetres for a view that has only those two", () => {
    expect(toCmOrIn("mm")).toBe("cm");
    expect(toCmOrIn("cm")).toBe("cm");
    expect(toCmOrIn("in")).toBe("in");
  });

  it("says it in Settings' words", () => {
    expect(unitSummary("mm")).toBe("Millimetres for garments · px for social");
    expect(unitSummary("in")).toBe("Inches for garments · px for social");
  });

  it("is read from the person's row, and a missing row or a failed read is the default", async () => {
    expect(await readLengthUnit(reading({ length_unit: "in" }), "u")).toBe("in");
    expect(await readLengthUnit(reading(null), "u")).toBe("mm");
    expect(await readLengthUnit(reading(null, { message: "x" }), "u")).toBe("mm");
  });

  it("is saved through set_length_unit, and a failure says so", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await saveLengthUnit({ rpc } as never, "u", "cm");
    expect(rpc).toHaveBeenCalledWith("set_length_unit", { p_user_id: "u", p_unit: "cm" });
    const failing = vi.fn().mockResolvedValue({ error: { code: "22023" } });
    await expect(saveLengthUnit({ rpc: failing } as never, "u", "cm")).rejects.toThrow("could not be saved");
  });
});
