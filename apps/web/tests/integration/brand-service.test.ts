import { describe, expect, it } from "vitest";
import { createBrand, listBrands, renameBrand } from "@/lib/brands/service";
import { AppError } from "@/lib/server/core/errors";
import { anonClient, person } from "./support";

const failureOf = async (work: Promise<unknown>): Promise<AppError> => {
  try {
    await work;
  } catch (error) {
    if (error instanceof AppError) return error;
    throw error;
  }
  throw new Error("Expected the call to fail.");
};

describe("brand service", () => {
  it("creates a brand and lists it with the caller's role", async () => {
    const maker = await person("service");

    const created = await createBrand(maker.client, "Northfield FC");

    expect(created).toEqual({ id: expect.any(String), name: "Northfield FC", role: "owner" });
    expect(await listBrands(maker.client)).toEqual([created]);
  });

  it("lists brands oldest first, so the first one is a stable default", async () => {
    const maker = await person("order");
    const one = await createBrand(maker.client, "One");
    const two = await createBrand(maker.client, "Two");

    expect((await listBrands(maker.client)).map((brand) => brand.id)).toEqual([one.id, two.id]);
  });

  it("lists nothing for someone with no brands", async () => {
    const maker = await person("none");

    expect(await listBrands(maker.client)).toEqual([]);
  });

  it("refuses to list brands for a visitor who is not signed in", async () => {
    expect((await failureOf(listBrands(anonClient()))).code).toBe("unauthenticated");
  });

  it("names the field when the brand name is not acceptable", async () => {
    const maker = await person("bad-name");

    const failure = await failureOf(createBrand(maker.client, "   "));

    expect(failure.code).toBe("invalid_input");
    expect(failure.fields).toEqual({ name: ["A brand name has 1 to 80 characters."] });
  });

  it("explains the limit when someone asks for a fourth brand", async () => {
    const maker = await person("limit");
    for (const name of ["One", "Two", "Three"]) await createBrand(maker.client, name);

    const failure = await failureOf(createBrand(maker.client, "Four"));

    expect(failure.code).toBe("conflict");
    expect(failure.message).toBe("You can belong to 3 brands at most.");
  });

  it("refuses a visitor who is not signed in", async () => {
    const failure = await failureOf(createBrand(anonClient(), "Nobody's"));

    expect(failure.code).toBe("unauthenticated");
  });

  it("renames a brand for its owner", async () => {
    const maker = await person("rename");
    const brand = await createBrand(maker.client, "Old");

    await renameBrand(maker.client, brand.id, "New");

    expect(await listBrands(maker.client)).toEqual([{ ...brand, name: "New" }]);
  });

  it("answers not found when someone renames a brand that is not theirs", async () => {
    const owner = await person("owner");
    const stranger = await person("stranger");
    const brand = await createBrand(owner.client, "Theirs");

    const failure = await failureOf(renameBrand(stranger.client, brand.id, "Mine"));

    expect(failure.code).toBe("not_found");
    expect(await listBrands(owner.client)).toEqual([brand]);
  });

  it("does not show the database's own words for a failure it does not know", async () => {
    const maker = await person("unknown");

    const failure = await failureOf(renameBrand(maker.client, "not-an-id", "New"));

    expect(failure.message).not.toMatch(/uuid|syntax|invalid input/i);
  });
});
