import { describe, expect, it } from "vitest";
import {
  RAIL,
  brandIsCurrent,
  currentId,
  groupFor,
  groupStartsOpen,
  locate,
  moreFor,
  moreIsCurrent,
  placesFor,
  type Workspace,
} from "./nav";

/**
 * The shell's places (decision 0138): what the rail, the ⌄ group and ⋯ hold, and which of them an
 * address belongs to. The rail's order is `09`'s; the rest keep every v2.2 page a door.
 */

const BRAND: Workspace = { isClub: false, setUp: true };
const CLUB: Workspace = { isClub: true, setUp: true };

describe("the rail", () => {
  it("holds 09's six places in 09's order", () => {
    expect(RAIL.map((place) => place.label)).toEqual(["AI Studio", "Templates", "Mockups", "Marketing", "Products", "Projects"]);
  });

  it("points Products at the v2.2 page that serves it for now, and Projects at its own page", () => {
    expect(RAIL.find((place) => place.id === "products")?.href).toBe("/catalogue");
    expect(RAIL.find((place) => place.id === "projects")?.href).toBe("/projects");
  });
});

describe("the ⌄ group", () => {
  it("shows Team to a club only", () => {
    expect(groupFor(CLUB).map((place) => place.label)).toEqual(["Orders", "Store", "Team"]);
    expect(groupFor(BRAND).map((place) => place.label)).toEqual(["Orders", "Store"]);
  });

  it("starts open when the page is inside it", () => {
    expect(groupStartsOpen("/orders/runs", BRAND)).toBe(true);
    expect(groupStartsOpen("/team", CLUB)).toBe(true);
    expect(groupStartsOpen("/studio", BRAND)).toBe(false);
  });
});

describe("⋯", () => {
  it("keeps a door to every v2.2 page with no rail item", () => {
    const hrefs = moreFor(BRAND).map((place) => place.href);
    expect(hrefs).toEqual(["/launch", "/teamwear", "/studio/charts", "/ai-studio/workflow/benchmark-products", "/designer", "/team"]);
  });

  it("does not list the club page twice for a club, whose rail already has Team", () => {
    expect(moreFor(CLUB).map((place) => place.href)).not.toContain("/team");
  });

  it("reads as current when the page is one of its own", () => {
    expect(moreIsCurrent("/teamwear", BRAND)).toBe(true);
    expect(moreIsCurrent("/team", BRAND)).toBe(true);
    expect(moreIsCurrent("/team", CLUB)).toBe(false);
    expect(moreIsCurrent("/templates", BRAND)).toBe(false);
  });
});

describe("which place an address is in", () => {
  it("finds a rail place by its own address and the pages under it", () => {
    expect(currentId("/templates", BRAND)).toBe("templates");
    expect(currentId("/catalogue/JSY-SS-01", BRAND)).toBe("products");
    expect(currentId("/studio/0b5c3e4a-1111-4222-8333-944445555666/tech-pack", BRAND)).toBe("projects");
    expect(currentId("/ai-studio/workflow/crest-to-kit", BRAND)).toBe("ai-studio");
  });

  it("lets the longest prefix win, so a page under another place's address is its own", () => {
    expect(locate("/studio/charts", BRAND)).toMatchObject({ place: { id: "charts" }, where: "more" });
    expect(locate("/studio/benchmarks/abc", BRAND)?.place.id).toBe("benchmarks");
  });

  it("does not take a name that merely begins with a prefix", () => {
    expect(currentId("/templatesque", BRAND)).toBeNull();
    expect(currentId("/settings", BRAND)).toBeNull();
  });

  it("puts Team in the group for a club and in ⋯ for a brand (decision 0144)", () => {
    expect(currentId("/team", CLUB)).toBe("team");
    expect(currentId("/team", BRAND)).toBe("club");
  });

  it("lists every place once", () => {
    for (const workspace of [BRAND, CLUB]) {
      const ids = placesFor(workspace).map(({ place }) => place.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("the brand pill", () => {
  it("is current on the Brand page and the brand switcher, and nowhere else", () => {
    expect(brandIsCurrent("/brand")).toBe(true);
    expect(brandIsCurrent("/brand/import")).toBe(true);
    expect(brandIsCurrent("/brands")).toBe(true);
    expect(brandIsCurrent("/brandish")).toBe(false);
    expect(brandIsCurrent("/studio")).toBe(false);
  });
});
