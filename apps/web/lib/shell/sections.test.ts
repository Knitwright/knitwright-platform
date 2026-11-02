import { describe, expect, it } from "vitest";
import {
  currentInOverflow,
  isCurrent,
  overflowSections,
  PILLS,
  pillSections,
  sectionFor,
  STUDIO_SECTIONS,
} from "./sections";

/**
 * The studio's sections (decision 0103). The list is navigation data, so these say what the bar
 * draws, which addresses belong to which section, and which section the overflow button names.
 */

describe("the sections themselves", () => {
  it("offers every section the workstreams asked for, each with an address", () => {
    expect(STUDIO_SECTIONS.map((section) => section.label)).toEqual([
      "Designs",
      "Templates",
      "Launch",
      "Catalogue",
      "Size charts",
      "Designer",
      "Teamwear",
      "Club",
      "Brand",
      "Benchmarks",
    ]);
    for (const section of STUDIO_SECTIONS) {
      expect(section.href, section.label).toMatch(/^\//);
      expect(section.owns.length, section.label).toBeGreaterThan(0);
    }
  });

  it("has no two sections with the same address or the same words", () => {
    expect(new Set(STUDIO_SECTIONS.map((section) => section.href)).size).toBe(STUDIO_SECTIONS.length);
    expect(new Set(STUDIO_SECTIONS.map((section) => section.label)).size).toBe(STUDIO_SECTIONS.length);
  });

  it("owns the address it links to, so no section is drawn as current nowhere", () => {
    for (const section of STUDIO_SECTIONS) {
      expect(sectionFor(section.href), section.label).toBe(section);
    }
  });
});

describe("what the bar draws and what the menu holds", () => {
  it("keeps the first four as pills and lists the rest", () => {
    expect(PILLS).toBe(4);
    expect(pillSections().map((section) => section.label)).toEqual(["Designs", "Templates", "Launch", "Catalogue"]);
    expect(overflowSections()).toHaveLength(STUDIO_SECTIONS.length - PILLS);
    // Launch sits beside Designs and Templates, which is what decision 0091 asked for.
    expect(pillSections()[2]?.href).toBe("/launch");
  });

  it("puts every section in exactly one of the two places", () => {
    expect([...pillSections(), ...overflowSections()]).toEqual([...STUDIO_SECTIONS]);
  });
});

describe("the section an address belongs to", () => {
  it("is the section's own page and the pages under it", () => {
    expect(sectionFor("/studio")?.label).toBe("Designs");
    expect(sectionFor("/studio/abc-123")?.label).toBe("Designs");
    expect(sectionFor("/studio/abc-123/make/sample")?.label).toBe("Designs");
    expect(sectionFor("/club/seasons")?.label).toBe("Club");
    expect(sectionFor("/launch/xyz/history")?.label).toBe("Launch");
  });

  it("gives the longest owned prefix the address, so a section under another is still its own", () => {
    expect(sectionFor("/studio/charts")?.label).toBe("Size charts");
    expect(sectionFor("/studio/charts/crew-tee")?.label).toBe("Size charts");
    expect(sectionFor("/studio/benchmarks")?.label).toBe("Benchmarks");
    expect(sectionFor("/studio/benchmarks/abc")?.label).toBe("Benchmarks");
    // A page under /studio that no other section owns is still Designs.
    expect(sectionFor("/studio/collections")?.label).toBe("Designs");
  });

  it("is nothing at all for an address no section owns", () => {
    expect(sectionFor("/settings")).toBeNull();
    expect(sectionFor("/brands")).toBeNull();
    expect(sectionFor("/credits")).toBeNull();
    // A name that merely starts with a section's own is not inside it.
    expect(sectionFor("/brand-studio")).toBeNull();
    expect(sectionFor("/clubhouse")).toBeNull();
  });

  it("marks one section current and the others not", () => {
    const current = STUDIO_SECTIONS.filter((section) => isCurrent(section, "/teamwear"));
    expect(current.map((section) => section.label)).toEqual(["Teamwear"]);
    expect(STUDIO_SECTIONS.filter((section) => isCurrent(section, "/settings"))).toEqual([]);
  });
});

describe("what the overflow button says about the current section", () => {
  it("names the section when the current one is inside the menu", () => {
    expect(currentInOverflow("/teamwear")).toBe("Teamwear");
    expect(currentInOverflow("/studio/charts")).toBe("Size charts");
    expect(currentInOverflow("/studio/benchmarks")).toBe("Benchmarks");
  });

  it("says nothing when the current section is a pill, or when there is none", () => {
    expect(currentInOverflow("/studio")).toBeNull();
    expect(currentInOverflow("/launch")).toBeNull();
    expect(currentInOverflow("/settings")).toBeNull();
  });
});
