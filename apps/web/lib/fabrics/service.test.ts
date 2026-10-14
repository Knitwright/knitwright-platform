import { describe, expect, it } from "vitest";
import { AppError } from "@/lib/server/core/errors";
import { fakeDb } from "./fixtures/fake-db";
import { BENCHMARK_FABRICS } from "./seed";
import { fabricInputSchema, fabricTestInputSchema } from "./schemas";
import { profileWithTests } from "./profile";
import { printScaleFor } from "./print-scale";
import {
  FABRIC_NAME_TAKEN,
  FABRIC_NOT_FOUND,
  PHOTO_NOT_FOUND,
  TOO_MANY_FABRICS,
  addFabricTest,
  createFabric,
  listFabrics,
  listSavedSizeMaps,
  resetSizeMap,
  saveSizeMap,
  seedBenchmarkFabrics,
  updateFabric,
} from "./service";
import { effectiveSizeMaps } from "./size-maps";
import { DEFAULT_SIZE_LABEL_MAPS } from "@/lib/sizing";

const who = { brandId: "11111111-1111-4111-8111-111111111111", userId: "22222222-2222-4222-8222-222222222222" };
const fabric = (name: string, supplier = {}) => fabricInputSchema.parse({ name, supplier });
const shrinkTest = fabricTestInputSchema.parse({
  testedBy: "Priya Nair",
  testedOn: "2026-10-01",
  method: "Pressed 40 s at 200 C",
  shrinkLengthPct: "2",
  shrinkWidthPct: "1.5",
  pressTempC: "200",
  pressSeconds: "40",
});

const expectApp = async (promise: Promise<unknown>, code: string, message?: string) => {
  const error = await promise.then(() => null, (e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).code).toBe(code);
  if (message) expect((error as AppError).message).toBe(message);
};

describe("fabrics", () => {
  it("creates a fabric and lists it with its supplier sheet", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, who, fabric("Interlock", { gsm: 140 }));
    const [listed] = await listFabrics(db.client, who.brandId);
    expect(listed).toMatchObject({ id, name: "Interlock", tests: [] });
    expect(listed?.sheet.gsm).toEqual({ value: 140, source: "supplier-sheet" });
    expect(listed?.sheet.shrinkLengthPct.source).toBe("not-set");
  });

  it("only lists the brand's own fabrics", async () => {
    const db = fakeDb();
    await createFabric(db.client, who, fabric("Mine"));
    await createFabric(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, fabric("Theirs"));
    expect((await listFabrics(db.client, who.brandId)).map((f) => f.name)).toEqual(["Mine"]);
  });

  it("refuses a second fabric with the same name", async () => {
    const db = fakeDb();
    await createFabric(db.client, who, fabric("Interlock"));
    await expectApp(createFabric(db.client, who, fabric("interlock")), "conflict", FABRIC_NAME_TAKEN);
  });

  it("refuses more fabrics than a brand may keep", async () => {
    const rows = Array.from({ length: 60 }, (_, i) => ({ id: `id-${i}`, brand_id: who.brandId, name: `F${i}` }));
    const db = fakeDb({ base_fabrics: rows });
    await expectApp(createFabric(db.client, who, fabric("One more")), "invalid_input", TOO_MANY_FABRICS);
  });

  it("seeds the three benchmark fabrics once, every number not set", async () => {
    const db = fakeDb();
    expect(await seedBenchmarkFabrics(db.client, who)).toBe(true);
    expect(await seedBenchmarkFabrics(db.client, who)).toBe(false);
    const listed = await listFabrics(db.client, who.brandId);
    expect(listed.map((f) => f.name).sort()).toEqual(BENCHMARK_FABRICS.map((f) => f.name).sort());
    for (const f of listed) expect(Object.values(f.sheet).every((v) => v.source === "not-set")).toBe(true);
  });

  it("does not fail when two people seed at once", async () => {
    const db = fakeDb();
    db.failOn("base_fabrics", "insert", { code: "23505", message: "duplicate" });
    expect(await seedBenchmarkFabrics(db.client, who)).toBe(false);
  });

  it("updates the supplier sheet and keeps who made it", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, who, fabric("Interlock"));
    await updateFabric(db.client, { ...who, userId: "44444444-4444-4444-8444-444444444444" }, id, fabric("Interlock 2", { usableWidthMm: 1600 }));
    const row = db.tables.base_fabrics![0]!;
    expect(row.name).toBe("Interlock 2");
    expect(row.created_by).toBe(who.userId);
    expect((await listFabrics(db.client, who.brandId))[0]?.sheet.usableWidthMm.value).toBe(1600);
  });

  it("will not update another brand's fabric", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, fabric("Theirs"));
    await expectApp(updateFabric(db.client, who, id, fabric("Stolen")), "not_found", FABRIC_NOT_FOUND);
  });

  it("refuses to rename a fabric to a name already taken", async () => {
    const db = fakeDb();
    await createFabric(db.client, who, fabric("A"));
    const id = await createFabric(db.client, who, fabric("B"));
    db.failOn("base_fabrics", "update", { code: "23505", message: "duplicate" });
    await expectApp(updateFabric(db.client, who, id, fabric("A")), "conflict");
  });
});

describe("fabric tests", () => {
  it("adds a test, and the print scale then follows from it", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, who, fabric("Interlock"));
    const before = (await listFabrics(db.client, who.brandId))[0]!;
    expect(printScaleFor(profileWithTests(before.sheet, before.tests).profile)).toMatchObject({ length: 1, notScaled: true });

    await addFabricTest(db.client, who, id, shrinkTest);
    const after = (await listFabrics(db.client, who.brandId))[0]!;
    const scale = printScaleFor(profileWithTests(after.sheet, after.tests).profile);
    expect(scale.length).toBeCloseTo(1.0204, 4);
    expect(scale.width).toBeCloseTo(1.0152, 4);
    expect(after.tests[0]).toMatchObject({ testedBy: "Priya Nair", pressTempC: 200, shrinkWidthPct: 1.5, loadNewtons: null });
  });

  it("reads numbers the database returns as text", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, who, fabric("Interlock"));
    await addFabricTest(db.client, who, id, shrinkTest);
    db.tables.fabric_tests![0]!.shrink_length_pct = "2.0";
    expect((await listFabrics(db.client, who.brandId))[0]?.tests[0]?.shrinkLengthPct).toBe(2);
  });

  it("will not add a test to a fabric that is not the brand's", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, { ...who, brandId: "33333333-3333-4333-8333-333333333333" }, fabric("Theirs"));
    await expectApp(addFabricTest(db.client, who, id, shrinkTest), "not_found", FABRIC_NOT_FOUND);
    expect(db.tables.fabric_tests ?? []).toEqual([]);
  });

  it("keeps photos only when they are the brand's files", async () => {
    const photo = "55555555-5555-4555-8555-555555555555";
    const db = fakeDb({ files: [{ id: photo, brand_id: who.brandId }, { id: "66666666-6666-4666-8666-666666666666", brand_id: "other" }] });
    const id = await createFabric(db.client, who, fabric("Interlock"));
    await addFabricTest(db.client, who, id, { ...shrinkTest, photoFileIds: [photo, photo] });
    expect(db.tables.fabric_tests![0]?.photo_file_ids).toEqual([photo]);
    await expectApp(addFabricTest(db.client, who, id, { ...shrinkTest, photoFileIds: ["66666666-6666-4666-8666-666666666666"] }), "not_found", PHOTO_NOT_FOUND);
  });

  it("fails loudly when the database does", async () => {
    const db = fakeDb();
    const id = await createFabric(db.client, who, fabric("Interlock"));
    db.failOn("fabric_tests", "insert", { message: "boom" });
    await expect(addFabricTest(db.client, who, id, shrinkTest)).rejects.toThrow("could not be saved");
    db.failOn("fabric_tests", "select", { message: "boom" });
    await expect(listFabrics(db.client, who.brandId)).rejects.toThrow("fabric tests could not be read");
    db.failOn("base_fabrics", "select", { message: "boom" });
    await expect(listFabrics(db.client, who.brandId)).rejects.toThrow("fabrics could not be read");
  });

  it("refuses an answer from the database it does not understand", async () => {
    const db = fakeDb({ base_fabrics: [{ id: "not-an-id", brand_id: who.brandId }] });
    await expect(listFabrics(db.client, who.brandId)).rejects.toThrow("unexpected answer");
  });
});

describe("size maps", () => {
  const entry = { label: "M", wearer: "men", cut: "mens", patternSize: "50", source: "user-edited" } as const;

  it("shows the suggested map until the brand chooses", async () => {
    const db = fakeDb();
    const saved = await listSavedSizeMaps(db.client, who.brandId);
    expect(saved).toEqual([]);
    expect(effectiveSizeMaps(saved)).toEqual(DEFAULT_SIZE_LABEL_MAPS);
  });

  it("saves a choice, which then replaces the suggestion for that label only", async () => {
    const db = fakeDb();
    await saveSizeMap(db.client, who, entry);
    await saveSizeMap(db.client, who, { ...entry, patternSize: "52" });
    const saved = await listSavedSizeMaps(db.client, who.brandId);
    expect(saved).toEqual([{ label: "M", wearer: "men", cut: "mens", patternSize: "52", source: "user-edited" }]);
    const effective = effectiveSizeMaps(saved);
    expect(effective.find((m) => m.label === "M" && m.cut === "mens")).toMatchObject({ patternSize: "52", source: "user-edited" });
    expect(effective.find((m) => m.label === "L" && m.cut === "mens")?.source).toBe("suggested");
  });

  it("refuses a label that is not in any size run", async () => {
    await expectApp(saveSizeMap(fakeDb().client, who, { ...entry, label: "9XL" }), "invalid_input");
  });

  it("goes back to the suggestion when reset", async () => {
    const db = fakeDb();
    await saveSizeMap(db.client, who, entry);
    await resetSizeMap(db.client, who, entry);
    expect(await listSavedSizeMaps(db.client, who.brandId)).toEqual([]);
  });

  it("does not reset another brand's choice", async () => {
    const db = fakeDb();
    const other = { ...who, brandId: "33333333-3333-4333-8333-333333333333" };
    await saveSizeMap(db.client, other, entry);
    await resetSizeMap(db.client, who, entry);
    expect(await listSavedSizeMaps(db.client, other.brandId)).toHaveLength(1);
  });

  it("fails loudly when the database does", async () => {
    const db = fakeDb();
    db.failOn("size_label_maps", "select", { message: "boom" });
    await expect(listSavedSizeMaps(db.client, who.brandId)).rejects.toThrow();
    db.failOn("size_label_maps", "upsert", { message: "boom" });
    await expect(saveSizeMap(db.client, who, entry)).rejects.toThrow();
    db.failOn("size_label_maps", "delete", { message: "boom" });
    await expect(resetSizeMap(db.client, who, entry)).rejects.toThrow();
  });
});
