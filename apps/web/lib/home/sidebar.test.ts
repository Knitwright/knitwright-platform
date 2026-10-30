import { describe, expect, it } from "vitest";
import { SIDEBAR, sidebarItem, sidebarItems } from "./sidebar";
import { COMING_LATER, hrefOf, isLater } from "./targets";

/**
 * Decision 0074: the sidebar of spec F-S4, and the rule that no entry is ever a dead link. Every
 * entry either opens a page of the app, opens the create-new modal, writes an email, or says
 * "Coming in a later release".
 */

describe("the studio sidebar", () => {
  it("holds every entry spec F-S4 lists, in its order, and the later workstreams' own entries after them", () => {
    expect(sidebarItems().map((item) => item.label)).toEqual([
      "+ New",
      "Workspace",
      "Products",
      "Brand kit",
      "All",
      "Designs",
      "Collections",
      "Moodboards",
      "Pattern fills",
      "Mockups",
      "Flows",
      "Base products",
      "Templates",
      "Fabrics",
      "Size charts",
      // Added by plan v5 Z3 (spec F-S2, decision 0084), after the entries F-S4 names.
      "Benchmarks",
      "Help",
      "Trash",
    ]);
  });

  it("gives every entry a target, and every id is its own", () => {
    const ids = sidebarItems().map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const item of sidebarItems()) expect(item.target.kind, item.id).toMatch(/^(page|new-design|external|later)$/);
  });

  it("opens the create-new modal from + New and the workspace list from the switcher", () => {
    expect(sidebarItem("new")?.target).toEqual({ kind: "new-design" });
    expect(hrefOf(sidebarItem("workspace")!.target)).toBe("/brands");
  });

  it("points Products, Brand kit and the library at pages that exist", () => {
    expect(hrefOf(sidebarItem("products")!.target)).toBe("/studio");
    expect(hrefOf(sidebarItem("brand-kit")!.target)).toBe("/brand");
    expect(hrefOf(sidebarItem("base-products")!.target)).toBe("/catalogue");
    expect(hrefOf(sidebarItem("templates")!.target)).toBe("/catalogue?tab=templates");
    expect(hrefOf(sidebarItem("fabrics")!.target)).toBe("/brands/fabrics");
    expect(hrefOf(sidebarItem("size-charts")!.target)).toBe("/studio/charts");
  });

  it("marks the Projects sections that are not built as coming later, never as a link", () => {
    for (const id of ["collections", "moodboards", "pattern-fills", "mockups", "flows", "trash"]) {
      const item = sidebarItem(id);
      expect(item, id).toBeDefined();
      expect(isLater(item!.target), id).toBe(true);
      expect(hrefOf(item!.target), id).toBeNull();
    }
  });

  it("writes to the team for Help, so the entry does something today", () => {
    expect(hrefOf(sidebarItem("help")!.target)).toMatch(/^mailto:.+@.+$/);
  });

  it("groups the entries, and only the top group has no heading", () => {
    expect(SIDEBAR.map((group) => group.label)).toEqual([null, "Yours", "Projects", "Library", "Help and Trash"]);
  });

  it("says the same sentence everywhere a section is not built yet", () => {
    expect(COMING_LATER).toBe("Coming in a later release");
  });
});
