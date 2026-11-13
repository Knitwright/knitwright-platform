import { describe, expect, it } from "vitest";
import { sampleStorefront } from "./fixtures/samples";
import { DEFAULT_RETURNS_POLICY } from "./policy";
import { storefrontBody, storefrontDefaults, storefrontWrite } from "./settings";

const INPUT = { name: "Lions", slug: "Lions-FC", status: "live", returnsPolicy: "Policy", euResponsiblePerson: "" };

describe("storefront settings", () => {
  it("checks the address: lower case, the slug rule, no reserved name", () => {
    expect(storefrontBody.parse(INPUT)).toMatchObject({ slug: "lions-fc", euResponsiblePerson: null });
    for (const slug of ["ab", "admin", "a--b", "-ab", "has space"]) expect(storefrontBody.safeParse({ ...INPUT, slug }).success).toBe(false);
    expect(storefrontBody.safeParse({ ...INPUT, returnsPolicy: " " }).success).toBe(false);
  });

  it("starts from the saved storefront, or the brand's name and the spec's policy", () => {
    expect(storefrontDefaults(null, "Lions FC", "lions-fc")).toEqual({ name: "Lions FC", slug: "lions-fc", status: "draft", returnsPolicy: DEFAULT_RETURNS_POLICY, euResponsiblePerson: "" });
    expect(storefrontDefaults(sampleStorefront({ euResponsiblePerson: "EU Rep" }), "x", "y")).toMatchObject({ slug: "example-fc", euResponsiblePerson: "EU Rep" });
  });

  it("makes whoever puts the storefront live the person its batches are ordered as", () => {
    const input = storefrontBody.parse(INPUT);
    expect(storefrontWrite(input, "b", "alice", null).batch_owner).toBe("alice");
    expect(storefrontWrite(input, "b", "bob", sampleStorefront({ status: "draft", batchOwner: "alice" })).batch_owner).toBe("bob");
    expect(storefrontWrite(input, "b", "bob", sampleStorefront({ status: "live", batchOwner: "alice" })).batch_owner).toBe("alice");
    expect(storefrontWrite({ ...input, status: "draft" }, "b", "bob", null).batch_owner).toBeNull();
    expect(storefrontWrite(input, "b", "bob", sampleStorefront({ status: "live", batchOwner: null })).batch_owner).toBe("bob");
  });
});
