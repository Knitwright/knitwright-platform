import { beforeAll, describe, expect, it } from "vitest";
import { loadMemberNames } from "@/lib/projects/member-names";
import { adminClient, anonClient, brandOf, person, type Person } from "./support";

/**
 * "Made by" in the tech pack shows a person's name from their profile, else their email
 * (owner decision 2026-09-30). Brand isolation must hold: a member learns the names of their
 * own brand's members and of no one else.
 */

let ada: Person;
let bob: Person;
let adaBrand: string;
let bobBrand: string;

beforeAll(async () => {
  [ada, bob] = await Promise.all([person("ada"), person("bob")]);
  [adaBrand, bobBrand] = await Promise.all([brandOf(ada, "Ada Athletic"), brandOf(bob, "Bob Boots")]);
  const named = await ada.client.auth.updateUser({ data: { display_name: "  Ada Lovelace\u0007 " } });
  if (named.error) throw new Error(named.error.message);
});

describe("brand_member_names", () => {
  it("gives a member the name from their profile, cleaned", async () => {
    const names = await loadMemberNames(ada.client, adaBrand);

    expect([...names]).toEqual([[ada.userId, "Ada Lovelace"]]);
  });

  it("falls back to the email address when no name is given", async () => {
    const names = await loadMemberNames(bob.client, bobBrand);

    expect(names.get(bob.userId)).toBe(bob.email);
  });

  it("uses the name from Google when the person set none", async () => {
    const carol = await person("carol");
    const carolBrand = await brandOf(carol, "Carol Cycling");
    const set = await adminClient().auth.admin.updateUserById(carol.userId, { user_metadata: { full_name: "Carol Google" } });
    if (set.error) throw new Error(set.error.message);

    expect((await loadMemberNames(carol.client, carolBrand)).get(carol.userId)).toBe("Carol Google");
  });

  it("names no one of another brand, not even to a member of some brand", async () => {
    expect([...(await loadMemberNames(ada.client, bobBrand))]).toEqual([]);
    expect([...(await loadMemberNames(bob.client, adaBrand))]).toEqual([]);
  });

  it("answers nobody who is not signed in", async () => {
    expect((await anonClient().rpc("brand_member_names", { p_brand_id: adaBrand })).error).not.toBeNull();
  });
});
