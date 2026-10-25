import { describe, expect, it } from "vitest";
import { defaultFactoryProfile } from "@/lib/validation/profile";
import { termsFor } from "./run-context";

describe("termsFor", () => {
  it("says not set for everything the default profile does not know, and invents nothing", () => {
    const terms = termsFor(defaultFactoryProfile(), "crew-tee");
    expect(terms.moq).toEqual({ status: "not-set" });
    expect(terms.ladder).toEqual({ status: "not-set" });
    expect(terms.fabrics).toEqual([]);
    expect(terms.factoryLabel).toMatch(/not agreed with a factory/);
  });
  it("takes the minimum of the garment type from the profile", () => {
    const base = defaultFactoryProfile();
    const profile = { ...base, articles: [{ typeId: "crew-tee", moq: { status: "set", value: 50 } as const }], fabrics: [{ name: "Mesh", swatchRef: null, colourDelta: { status: "not-set" } as const }] };
    expect(termsFor(profile, "crew-tee").moq).toEqual({ status: "set", value: 50 });
    expect(termsFor(profile, "crew-tee").fabrics).toEqual(["Mesh"]);
    expect(termsFor(profile, "hoodie").moq).toEqual({ status: "not-set" });
  });
});
