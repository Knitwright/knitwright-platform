import { describe, expect, it } from "vitest";
import { BRAND_NAME_MAX, MAX_BRANDS } from "@/lib/brands/limits";
import { anonClient, brandOf, must, person } from "./support";

// The limits are written in the database and again in the app, for the forms. These
// tests use the app's numbers against the database, so they fail if the two disagree.
const NAME_RULE = `A brand name has 1 to ${BRAND_NAME_MAX} characters.`;
const LIMIT_REACHED = `You can belong to ${MAX_BRANDS} brands at most.`;

describe("create_brand", () => {
  it("creates a brand and makes the caller its owner", async () => {
    const maker = await person("maker");

    const brandId = await brandOf(maker, "Northfield FC");

    const brands = must(await maker.client.from("brands").select("id, name, created_by"));
    expect(brands).toEqual([{ id: brandId, name: "Northfield FC", created_by: maker.userId }]);
    const memberships = must(await maker.client.from("memberships").select("brand_id, role"));
    expect(memberships).toEqual([{ brand_id: brandId, role: "owner" }]);
  });

  it("trims the name", async () => {
    const maker = await person("trim");

    await brandOf(maker, "  Northfield FC  ");

    expect(must(await maker.client.from("brands").select("name"))).toEqual([
      { name: "Northfield FC" },
    ]);
  });

  it("refuses a name that is empty or longer than 80 characters", async () => {
    const maker = await person("names");

    for (const name of ["", "   ", "x".repeat(BRAND_NAME_MAX + 1)]) {
      const { error } = await maker.client.rpc("create_brand", { p_name: name });
      expect(error?.message).toBe(NAME_RULE);
    }
    expect(must(await maker.client.from("brands").select("id"))).toEqual([]);
  });

  it("accepts a name of exactly the longest length", async () => {
    const maker = await person("longest");

    await expect(brandOf(maker, "x".repeat(BRAND_NAME_MAX))).resolves.toEqual(expect.any(String));
  });

  it("refuses one brand more than the limit for one person", async () => {
    const maker = await person("cap");
    for (let count = 0; count < MAX_BRANDS; count += 1) await brandOf(maker, `Brand ${count}`);

    const { error } = await maker.client.rpc("create_brand", { p_name: "One too many" });

    expect(error?.message).toBe(LIMIT_REACHED);
    expect(error?.hint).toBe("brand_limit");
    expect(must(await maker.client.from("brands").select("id"))).toHaveLength(MAX_BRANDS);
  });

  it("holds the cap when ten requests arrive at once", async () => {
    const maker = await person("race");

    const results = await Promise.all(
      Array.from({ length: 10 }, (_, index) =>
        maker.client.rpc("create_brand", { p_name: `Brand ${index}` }),
      ),
    );

    expect(results.filter((result) => result.error === null)).toHaveLength(MAX_BRANDS);
    expect(must(await maker.client.from("brands").select("id"))).toHaveLength(MAX_BRANDS);
  });

  it("counts each person on their own", async () => {
    const first = await person("first");
    const second = await person("second");
    await brandOf(first, "One");
    await brandOf(first, "Two");
    await brandOf(first, "Three");

    await expect(brandOf(second, "Mine")).resolves.toEqual(expect.any(String));
  });

  it("refuses a visitor who is not signed in", async () => {
    const { error } = await anonClient().rpc("create_brand", { p_name: "Nobody's" });

    expect(error).not.toBeNull();
  });
});

describe("rename_brand", () => {
  it("lets the owner rename the brand", async () => {
    const maker = await person("rename");
    const brandId = await brandOf(maker, "Old name");

    must(await maker.client.rpc("rename_brand", { p_brand_id: brandId, p_name: "New name" }));

    expect(must(await maker.client.from("brands").select("name"))).toEqual([{ name: "New name" }]);
  });

  it("refuses someone who does not belong to the brand, as if it did not exist", async () => {
    const owner = await person("owner");
    const stranger = await person("stranger");
    const brandId = await brandOf(owner, "Theirs");

    const { error } = await stranger.client.rpc("rename_brand", {
      p_brand_id: brandId,
      p_name: "Mine now",
    });

    expect(error?.message).toBe("That brand does not exist.");
    expect(must(await owner.client.from("brands").select("name"))).toEqual([{ name: "Theirs" }]);
  });

  it("gives the same answer for a brand that really does not exist", async () => {
    const maker = await person("missing");

    const { error } = await maker.client.rpc("rename_brand", {
      p_brand_id: "00000000-0000-4000-8000-000000000000",
      p_name: "Anything",
    });

    expect(error?.message).toBe("That brand does not exist.");
  });
});
