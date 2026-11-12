import { beforeAll, describe, expect, it } from "vitest";
import { readLengthUnit, saveLengthUnit } from "@/lib/units/preference";
import { adminClient, anonClient, must, person, type Person } from "./support";

/**
 * A person's unit for garment lengths (plan v6 P6, decision 0144), against local Supabase. Read with the
 * person's own client, written by the server through `set_length_unit`.
 */

let ann: Person;
let bea: Person;

beforeAll(async () => {
  ann = await person("units-ann");
  bea = await person("units-bea");
});

describe("person_preferences", () => {
  it("reads millimetres when nothing was chosen", async () => {
    expect(await readLengthUnit(bea.client, bea.userId)).toBe("mm");
  });

  it("keeps the chosen unit and changes it", async () => {
    await saveLengthUnit(adminClient(), ann.userId, "cm");
    expect(await readLengthUnit(ann.client, ann.userId)).toBe("cm");
    await saveLengthUnit(adminClient(), ann.userId, "in");
    expect(await readLengthUnit(ann.client, ann.userId)).toBe("in");
  });

  it("shows a person only their own row", async () => {
    await saveLengthUnit(adminClient(), ann.userId, "cm");
    expect(must(await bea.client.from("person_preferences").select("user_id").eq("user_id", ann.userId))).toEqual([]);
    expect(await readLengthUnit(bea.client, ann.userId)).toBe("mm");
  });

  it("refuses a unit that is not one of the three", async () => {
    const { error } = await adminClient().rpc("set_length_unit", { p_user_id: ann.userId, p_unit: "ft" });
    expect(error?.code).toBe("22023");
  });

  it("cannot be written from a browser, signed in or not", async () => {
    const args = { p_user_id: ann.userId, p_unit: "mm" };
    expect((await ann.client.rpc("set_length_unit", args)).error).not.toBeNull();
    expect((await anonClient().rpc("set_length_unit", args)).error).not.toBeNull();
    expect((await ann.client.from("person_preferences").insert({ user_id: ann.userId, length_unit: "mm" })).error).not.toBeNull();
  });
});
