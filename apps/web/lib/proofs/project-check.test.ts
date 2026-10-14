import { describe, expect, it } from "vitest";
import { fakeClient } from "@/lib/orders/fixtures/fake-client";
import { assertProjectOfBrand } from "./project-check";

const BRAND = "11111111-1111-4111-8111-111111111111";
const PROJECT = "22222222-2222-4222-8222-222222222222";

describe("assertProjectOfBrand", () => {
  it("passes when the brand has the design, and asks for that brand and design only", async () => {
    const { client, calls } = fakeClient({ projects: { data: { id: PROJECT } } });
    await expect(assertProjectOfBrand(client, BRAND, PROJECT)).resolves.toBeUndefined();
    const eqs = calls[0]?.steps.filter(([s]) => s === "eq").map(([, a]) => a);
    expect(eqs).toEqual(expect.arrayContaining([["id", PROJECT], ["brand_id", BRAND]]));
  });

  it("says the design does not exist when the brand has no such design", async () => {
    const { client } = fakeClient({ projects: { data: null } });
    await expect(assertProjectOfBrand(client, BRAND, PROJECT)).rejects.toMatchObject({ code: "not_found" });
  });

  it("says the same when the lookup fails", async () => {
    const { client } = fakeClient({ projects: { error: { message: "boom" } } });
    await expect(assertProjectOfBrand(client, BRAND, PROJECT)).rejects.toMatchObject({ code: "not_found" });
  });
});
