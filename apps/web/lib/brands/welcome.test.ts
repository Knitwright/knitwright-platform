import { describe, expect, it } from "vitest";
import { ORGANISATION_TYPES } from "@/lib/leads/organisation";
import { welcomeWording } from "./welcome";

describe("the words of the welcome page", () => {
  it("names a club as a club, and a school as a school", () => {
    expect(welcomeWording("club")).toEqual({
      nameLabel: "Club name",
      nameHint: "For example, Northfield FC. You can change it later.",
      submit: "Set up your club",
    });
    expect(welcomeWording("school").nameLabel).toBe("School name");
    expect(welcomeWording("school").submit).toBe("Set up your school");
  });

  it("keeps the brand words for a brand", () => {
    expect(welcomeWording("brand")).toMatchObject({ nameLabel: "Brand name", submit: "Create brand" });
  });

  it("has words for every type of organisation", () => {
    for (const type of ORGANISATION_TYPES) {
      const words = welcomeWording(type.id);
      expect(words.nameLabel).toMatch(/ name$/);
      expect(words.nameHint).toMatch(/You can change it later\.$/);
      expect(words.submit.length).toBeGreaterThan(0);
    }
  });

  it("asks for a name in general words before the type is chosen, or for a type it does not know", () => {
    const general = { nameLabel: "Name of your club, school or brand", nameHint: "You can change it later.", submit: "Continue" };
    expect(welcomeWording("")).toEqual(general);
    expect(welcomeWording("other")).toEqual(general);
  });
});
