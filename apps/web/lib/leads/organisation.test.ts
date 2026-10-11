import { describe, expect, it } from "vitest";
import {
  AU_STATES,
  COUNTRY_CODES,
  ORGANISATION_TYPES,
  countryName,
  countryOptions,
  missingDetails,
  organisationDetailsSchema,
  placeOf,
} from "./organisation";

const parse = (input: Record<string, string>) => organisationDetailsSchema.safeParse(input);

describe("organisationDetailsSchema", () => {
  it("takes nothing at all, since every detail is optional", () => {
    expect(parse({})).toEqual({ success: true, data: { organisationType: null, country: null, region: null } });
    expect(parse({ organisationType: "", country: "", region: "" }).data).toEqual({
      organisationType: null,
      country: null,
      region: null,
    });
  });

  it("takes an Australian club in a state", () => {
    expect(parse({ organisationType: "club", country: "AU", region: "VIC" }).data).toEqual({
      organisationType: "club",
      country: "AU",
      region: "VIC",
    });
  });

  it("refuses a place in Australia that is not one of its states", () => {
    const result = parse({ country: "AU", region: "Victoria" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({ path: ["region"], message: "Choose a state or territory." });
  });

  it("takes any region, trimmed, outside Australia", () => {
    expect(parse({ country: "GB", region: "  Yorkshire " }).data).toMatchObject({ country: "GB", region: "Yorkshire" });
  });

  it("refuses a region with no country, an unknown country and an unknown type", () => {
    expect(parse({ region: "Yorkshire" }).error?.issues[0].path).toEqual(["region"]);
    expect(parse({ country: "XX" }).error?.issues[0].path).toEqual(["country"]);
    expect(parse({ organisationType: "charity" }).error?.issues[0].path).toEqual(["organisationType"]);
  });

  it("refuses a region that is too long or holds hidden characters", () => {
    expect(parse({ country: "GB", region: "x".repeat(81) }).success).toBe(false);
    expect(parse({ country: "GB", region: "York\u0007" }).success).toBe(false);
  });
});

describe("missingDetails", () => {
  it("names what is not given yet", () => {
    expect(missingDetails({ organisationType: null, country: null, region: null })).toEqual([
      "organisationType",
      "country",
      "region",
    ]);
    expect(missingDetails({ organisationType: "gym", country: "AU", region: "WA" })).toEqual([]);
  });
});

describe("countries", () => {
  it("puts Australia first and names every country", () => {
    const options = countryOptions();

    expect(options[0]).toEqual({ id: "AU", label: "Australia" });
    expect(options).toHaveLength(COUNTRY_CODES.length);
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    expect(countryName("GB")).toBe("United Kingdom");
  });

  it("describes a place in a few words", () => {
    expect(placeOf("AU", "NSW")).toBe("Australia, NSW");
    expect(placeOf("GB", null)).toBe("United Kingdom");
    expect(placeOf(null, null)).toBe("Not given");
  });

  it("lists the eight Australian states and territories and the five organisation types", () => {
    expect(AU_STATES.map((state) => state.id)).toEqual(["ACT", "NSW", "NT", "QLD", "SA", "TAS", "VIC", "WA"]);
    expect(ORGANISATION_TYPES.map((type) => type.id)).toEqual(["club", "school", "brand", "gym", "event"]);
  });
});
