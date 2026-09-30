import { describe, expect, it } from "vitest";
import { loadMemberNames, madeBy } from "./member-names";

const ADA = "11111111-1111-4111-8111-111111111111";
const BOB = "22222222-2222-4222-8222-222222222222";

describe("madeBy", () => {
  const names = new Map([[ADA, "Ada Lovelace"]]);

  it("gives the name of a member of the brand", () => {
    expect(madeBy(ADA, names)).toBe("Ada Lovelace");
  });

  it("gives nothing for someone who is not a member, or no one", () => {
    expect(madeBy(BOB, names)).toBeNull();
    expect(madeBy(null, names)).toBeNull();
  });
});

describe("loadMemberNames", () => {
  it("asks the database for the brand's members and keeps each name by person", async () => {
    const calls: unknown[] = [];
    const rpc = async (fn: string, args: unknown) => {
      calls.push([fn, args]);
      return { data: [{ user_id: ADA, name: "Ada Lovelace" }, { user_id: BOB, name: "bob@example.com" }], error: null };
    };
    const names = await loadMemberNames({ rpc }, "brand-1");
    expect(calls).toEqual([["brand_member_names", { p_brand_id: "brand-1" }]]);
    expect([...names]).toEqual([
      [ADA, "Ada Lovelace"],
      [BOB, "bob@example.com"],
    ]);
  });

  it("throws when the names cannot be read", async () => {
    const rpc = async () => ({ data: null, error: { message: "down" } });
    await expect(loadMemberNames({ rpc }, "brand-1")).rejects.toThrow("The names of the brand's members could not be read.");
  });
});
