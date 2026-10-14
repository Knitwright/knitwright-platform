import { beforeAll, describe, expect, it } from "vitest";
import { addFabricTest, createFabric, listFabrics, saveSizeMap } from "@/lib/fabrics/service";
import { fabricInputSchema, fabricTestInputSchema } from "@/lib/fabrics/schemas";
import { adminClient, brandOf, person, type Person } from "./support";

/** Migration 20261015020000, through the real service: fabrics, tests and size label maps. */

let alice: Person;
let brandId: string;

beforeAll(async () => {
  alice = await person("alice");
  brandId = await brandOf(alice, "Alice Athletic");
});

describe("fabrics in the database", () => {
  it("keeps a fabric and its test, and a member of the brand reads both", async () => {
    const who = { brandId, userId: alice.userId };
    const id = await createFabric(adminClient(), who, fabricInputSchema.parse({ name: "Interlock", supplier: { usableWidthMm: 1600 } }));
    await addFabricTest(
      adminClient(),
      who,
      id,
      fabricTestInputSchema.parse({
        testedBy: "Priya Nair",
        testedOn: "2026-10-01",
        method: "Pressed 40 s at 200 C",
        shrinkLengthPct: 2,
        shrinkWidthPct: 1.5,
        pressTempC: 200,
        pressSeconds: 40,
      }),
    );
    const [fabric] = await listFabrics(alice.client, brandId);
    expect(fabric?.sheet.usableWidthMm).toEqual({ value: 1600, source: "supplier-sheet" });
    expect(fabric?.tests[0]).toMatchObject({ shrinkLengthPct: 2, shrinkWidthPct: 1.5, pressSeconds: 40 });
  });

  it("refuses a fabric name used twice, whatever its case", async () => {
    const who = { brandId, userId: alice.userId };
    await expect(createFabric(adminClient(), who, fabricInputSchema.parse({ name: "INTERLOCK" }))).rejects.toThrow();
  });

  it("never lets a test be changed, even by the server", async () => {
    const { data } = await adminClient().from("fabric_tests").select("id").eq("brand_id", brandId).limit(1).single();
    const { error } = await adminClient().from("fabric_tests").update({ tested_by: "Someone else" }).eq("id", data?.id);
    expect(error).not.toBeNull();
  });

  it("refuses a test with stretch but no load, and shrink with no press", async () => {
    const { data } = await adminClient().from("base_fabrics").select("id").eq("brand_id", brandId).limit(1).single();
    const base = { brand_id: brandId, fabric_id: data?.id, tested_by: "Priya Nair", tested_on: "2026-10-02", method: "x", created_by: alice.userId };
    expect((await adminClient().from("fabric_tests").insert({ ...base, stretch_width_pct: 20 })).error).not.toBeNull();
    expect((await adminClient().from("fabric_tests").insert({ ...base, shrink_width_pct: 2 })).error).not.toBeNull();
    expect((await adminClient().from("fabric_tests").insert({ ...base, method: "x" })).error).not.toBeNull();
  });

  it("saves a size label choice once per label", async () => {
    const who = { brandId, userId: alice.userId };
    const entry = { label: "M", wearer: "men", cut: "mens", patternSize: "50", source: "user-edited" } as const;
    await saveSizeMap(adminClient(), who, entry);
    await saveSizeMap(adminClient(), who, { ...entry, patternSize: "52" });
    const { data } = await adminClient().from("size_label_maps").select("pattern_size").eq("brand_id", brandId);
    expect(data).toEqual([{ pattern_size: "52" }]);
  });
});
