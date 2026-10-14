import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { JERSEY_EU48 } from "@/lib/production/fixtures";
import { AppError } from "@/lib/server/core/errors";
import { writeDxf } from "./dxf/write";

const created: Record<string, unknown>[] = [];
vi.mock("./service", () => ({
  createBlock: vi.fn(async (_admin: unknown, input: Record<string, unknown>) => {
    created.push(input);
    return { id: "block-1", version: 1, setFileId: "file-1" };
  }),
  createProgramme: vi.fn(async () => ({ id: "block-2", version: 1 })),
}));

const { overridesFrom, programmeFieldsSchema, uploadFieldsSchema, uploadProgramme, uploadSet } = await import("./upload");

const admin = {} as SupabaseClient;
const who = { brandId: "b", userId: "u" };
const dxf = (name = "jersey.dxf") => ({ name, bytes: new TextEncoder().encode(writeDxf(JERSEY_EU48.piecesBySize["48"], { styleName: "t" })) });
const fields = (patch: Record<string, unknown> = {}) => uploadFieldsSchema.parse({ productKey: "crew-tee", wearer: "men", cut: "mens", source: "technician-upload", outline: "net", ...patch });

describe("uploadFieldsSchema", () => {
  it("accepts a product with a pattern slot and refuses socks and unknown products", () => {
    expect(fields().productKey).toBe("crew-tee");
    expect(uploadFieldsSchema.safeParse({ productKey: "socks", wearer: "men", cut: "unisex", source: "technician-upload" }).success).toBe(false);
    expect(uploadFieldsSchema.safeParse({ productKey: "hat", wearer: "men", cut: "mens", source: "technician-upload" }).success).toBe(false);
  });

  it("reads landmarks placed by hand from JSON, and refuses bad JSON", () => {
    const parsed = fields({ landmarks: JSON.stringify({ "M/front": { hps: [1, 2], nonsense: [3, 4] } }) });
    expect(overridesFrom(parsed.landmarks)).toEqual({ "M/front": { hps: [1, 2] } });
    expect(overridesFrom(undefined)).toEqual({});
    expect(uploadFieldsSchema.safeParse({ productKey: "crew-tee", wearer: "men", cut: "mens", source: "technician-upload", landmarks: "{nope" }).success).toBe(false);
  });
});

describe("uploadSet", () => {
  it("stores the set as a block named for its slot and returns what the person should see", async () => {
    created.length = 0;
    const result = await uploadSet(admin, who, fields(), [dxf()]);
    expect(result).toMatchObject({ id: "block-1", version: 1, sizes: ["48"], questions: [] });
    expect(result.derived.some((d) => d.includes("seam allowance added"))).toBe(true);
    expect(created[0]).toMatchObject({ brandId: "b", userId: "u", productKey: "crew-tee", name: "Crew tee", source: "technician-upload" });
  });

  it("asks about the outline when it is not answered, and uses the name it is given", async () => {
    const result = await uploadSet(admin, who, fields({ outline: undefined, name: "Club tee", sizeOrder: "48, 50" }), [dxf()]);
    expect(result.questions[0]).toContain("seam allowance");
    expect(created.at(-1)).toMatchObject({ name: "Club tee" });
  });

  it("refuses no files, too many files, a file too large, a file that is not a DXF and a set that would not sew", async () => {
    await expect(uploadSet(admin, who, fields(), [])).rejects.toThrow("Choose between 1 and 30");
    await expect(uploadSet(admin, who, fields(), Array.from({ length: 31 }, () => dxf()))).rejects.toThrow("Choose between 1 and 30");
    await expect(uploadSet(admin, who, fields(), [{ name: "big.dxf", bytes: new Uint8Array(9 * 1024 * 1024) }])).rejects.toThrow("big.dxf is too large");
    await expect(uploadSet(admin, who, fields(), [{ name: "x.dxf", bytes: new TextEncoder().encode("hello") }])).rejects.toBeInstanceOf(AppError);
  });
});

describe("uploadProgramme", () => {
  it("accepts a size map for socks only", async () => {
    const parsed = programmeFieldsSchema.parse({ productKey: "socks", wearer: "men", cut: "unisex", source: "technician-upload", sizeMap: { M: "42-45" } });
    expect(parsed).toMatchObject({ name: "Knit programme", note: "" });
    expect(await uploadProgramme(admin, who, parsed)).toEqual({ id: "block-2", version: 1 });
    expect(programmeFieldsSchema.safeParse({ productKey: "crew-tee", wearer: "men", cut: "unisex", source: "technician-upload", sizeMap: { M: "x" } }).success).toBe(false);
    expect(programmeFieldsSchema.safeParse({ productKey: "socks", wearer: "men", cut: "unisex", source: "technician-upload", sizeMap: {} }).success).toBe(false);
  });
});
