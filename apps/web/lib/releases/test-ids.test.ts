import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { checkFabricTestIds } from "./test-ids";

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";
const SO = "55555555-5555-4555-8555-555555555555";
const FT = "66666666-6666-4666-8666-666666666666";

describe("checkFabricTestIds", () => {
  it("accepts a strike-off test and a fabric test of the brand", async () => {
    const { client } = fakeClient({ strike_offs: { data: [{ id: SO }] }, fabric_tests: { data: [{ id: FT }] } });
    await expect(checkFabricTestIds(client, BRAND, PROJECT, [`strike-off-${SO}`, FT])).resolves.toBeUndefined();
  });

  it("refuses an id that belongs to no test of the brand, naming it", async () => {
    const { client } = fakeClient({ strike_offs: { data: [] }, fabric_tests: { data: [] } });
    await expect(checkFabricTestIds(client, BRAND, PROJECT, [FT])).rejects.toMatchObject({ code: "invalid_input", message: expect.stringContaining(FT) });
  });

  it("refuses text that is not an id without asking the database", async () => {
    const { client, calls } = fakeClient({});
    await expect(checkFabricTestIds(client, BRAND, PROJECT, ["t1"])).rejects.toMatchObject({ code: "invalid_input" });
    expect(calls).toHaveLength(0);
  });

  it("asks nothing when there are no ids", async () => {
    const { client, calls } = fakeClient({});
    await checkFabricTestIds(client, BRAND, PROJECT, []);
    expect(calls).toHaveLength(0);
  });

  it("scopes both lookups to the brand", async () => {
    const { client, calls } = fakeClient({ strike_offs: { data: [] }, fabric_tests: { data: [{ id: FT }] } });
    await checkFabricTestIds(client, BRAND, PROJECT, [FT]);
    const eqs = calls.flatMap((c) => c.steps.filter(([s]) => s === "eq").map(([, a]) => a));
    expect(eqs).toContainEqual(["brand_id", BRAND]);
  });

  it("refuses when the fabric test table cannot be queried", async () => {
    const { client } = fakeClient({ strike_offs: { data: [{ id: SO }] }, fabric_tests: { error: { code: "XX000", message: "boom" } } });
    await expect(checkFabricTestIds(client, BRAND, PROJECT, [`strike-off-${SO}`, FT])).rejects.toThrow("could not be checked");
  });
});
