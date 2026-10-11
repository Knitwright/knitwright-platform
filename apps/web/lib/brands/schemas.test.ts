import { describe, expect, it } from "vitest";
import { brandNameFormSchema, newBrandFormSchema, switchBrandSchema } from "./schemas";

describe("brandNameFormSchema", () => {
  it("trims the name", () => {
    expect(brandNameFormSchema.parse({ name: "  Northfield FC " })).toEqual({
      name: "Northfield FC",
    });
  });

  it("refuses a name that is empty or too long, in plain words", () => {
    for (const name of ["", "   ", "x".repeat(81)]) {
      const result = brandNameFormSchema.safeParse({ name });
      expect(result.error?.issues[0].message).toBe("A brand name has 1 to 80 characters.");
    }
  });
});

describe("switchBrandSchema", () => {
  it("accepts a brand id", () => {
    const brandId = "11111111-1111-4111-8111-111111111111";
    expect(switchBrandSchema.parse({ brandId })).toEqual({ brandId });
  });

  it("refuses anything that is not an id", () => {
    for (const brandId of ["", "mine", "../brands", "1 or 1=1"]) {
      const result = switchBrandSchema.safeParse({ brandId });
      expect(result.error?.issues[0].message).toBe("Choose one of your brands.");
    }
  });
});

describe("newBrandFormSchema", () => {
  it("takes a name alone, the organisation details being optional", () => {
    expect(newBrandFormSchema.parse({ name: "Northfield FC" })).toEqual({
      name: "Northfield FC",
      organisationType: null,
      country: null,
      region: null,
    });
  });

  it("takes a name with the organisation details", () => {
    expect(newBrandFormSchema.parse({ name: "Northfield FC", organisationType: "club", country: "AU", region: "QLD" })).toEqual({
      name: "Northfield FC",
      organisationType: "club",
      country: "AU",
      region: "QLD",
    });
  });

  it("refuses a region in Australia that is not a state", () => {
    const result = newBrandFormSchema.safeParse({ name: "Northfield FC", country: "AU", region: "Brisbane" });
    expect(result.error?.issues.map((issue) => issue.path)).toEqual([["region"]]);
  });
});
