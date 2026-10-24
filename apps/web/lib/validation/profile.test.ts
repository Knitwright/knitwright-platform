import { describe, expect, it } from "vitest";
import { listTypes } from "@/lib/garment";
import { DEFAULT_PROFILE_LABEL, defaultFactoryProfile, factoryProfileSchema } from "./profile";

describe("the default factory profile", () => {
  const profile = defaultFactoryProfile();

  it("matches its schema and says it is not agreed with a factory", () => {
    expect(factoryProfileSchema.parse(profile)).toEqual(profile);
    expect(profile.label).toBe(DEFAULT_PROFILE_LABEL);
  });

  it("lists every article in the registry", () => {
    expect(profile.articles.map((a) => a.typeId)).toEqual(listTypes().map((t) => t.id));
  });

  it("invents no MOQ, price ladder, lead time or HS code", () => {
    expect(profile.articles.every((a) => a.moq.status === "not-set")).toBe(true);
    expect(profile.priceLadder).toEqual({ status: "not-set" });
    expect(profile.leadTimeDays).toEqual({ status: "not-set" });
    expect(profile.hsCodes).toEqual({ status: "not-set" });
  });

  it("refuses a set value without a number", () => {
    expect(factoryProfileSchema.safeParse({ ...profile, leadTimeDays: { status: "set", value: 0 } }).success).toBe(false);
  });
});
