import { describe, expect, it } from "vitest";
import { providerNamed, selectProviders } from "./select";

const keys = { PHOTOROOM_API_KEY: "p", FASHN_API_KEY: "f", FAL_KEY: "z", GOOGLE_VERTEX_ACCESS_TOKEN: "t", GOOGLE_VERTEX_PROJECT: "proj" };

describe("selectProviders", () => {
  it("chooses nothing by default, so nothing is made and nothing is spent", () => {
    expect(selectProviders({})).toEqual({ providers: [], problems: [] });
    expect(selectProviders(keys)).toEqual({ providers: [], problems: [] });
  });

  it("puts the try-on provider first and the scene provider second", () => {
    const { providers, problems } = selectProviders({ ...keys, LIFESTYLE_SCENE_PROVIDER: "photoroom", LIFESTYLE_TRYON_PROVIDER: "fashn" });
    expect(providers.map((p) => p.name)).toEqual(["fashn", "photoroom"]);
    expect(problems).toEqual([]);
  });

  it("builds each provider from its own key", () => {
    const names = Object.fromEntries(["stub", "photoroom", "google-recontext", "google-tryon", "fashn"].map((n) => [n, (providerNamed(n, keys) as { name: string }).name]));
    expect(names).toEqual({ stub: "stub-lifestyle", photoroom: "photoroom", "google-recontext": "google-recontext", "google-tryon": "google-tryon", fashn: "fashn" });
    expect((providerNamed("fal", keys) as { name: string }).name).toContain("fal");
  });

  it("names a missing key and leaves the provider out", () => {
    for (const name of ["photoroom", "fashn", "fal", "google-recontext", "google-tryon"]) expect(providerNamed(name, {})).toMatch(/is chosen but .* is not set/);
    expect(selectProviders({ LIFESTYLE_SCENE_PROVIDER: "fashn" })).toEqual({ providers: [], problems: ["fashn is chosen but FASHN_API_KEY is not set."] });
  });

  it("refuses a name it does not know", () => {
    expect(providerNamed("idm-vton", keys)).toBe("idm-vton is not a lifestyle provider.");
    expect(providerNamed("catvton", keys)).toMatch(/not a lifestyle provider/);
  });

  it("defaults the Google location", () => {
    expect(providerNamed("google-recontext", keys)).toMatchObject({ name: "google-recontext" });
  });
});
