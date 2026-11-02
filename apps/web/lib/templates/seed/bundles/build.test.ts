import { describe, expect, it } from "vitest";
import { GAP_RULE_ID } from "@/lib/rulebook/constants";
import { LAUNCH_COUNTS } from "../../kinds";
import { matchesTags } from "../../kinds/tags";
import { allSeedTemplates } from "../all";
import { SOCKS_GAP, buildBundles, bundleRowOf, memberRowsOf } from "./build";
import { BUNDLE_PLANS, BUNDLE_ROLES, BUNDLE_SLOTS } from "./plans";

const bundles = buildBundles();
const designs = new Map(allSeedTemplates().map((seed) => [seed.slug, seed]));

describe("the kit bundles at launch", () => {
  it("are the 15 that 07 asks for, each with its own slug and title", () => {
    expect(bundles).toHaveLength(LAUNCH_COUNTS.kit_bundle);
    expect(new Set(bundles.map((bundle) => bundle.slug)).size).toBe(bundles.length);
    expect(new Set(bundles.map((bundle) => bundle.title)).size).toBe(bundles.length);
  });

  it("are built the same way every time", () => {
    expect(JSON.stringify(buildBundles())).toBe(JSON.stringify(bundles));
  });

  it("holds only designs that are in the library, each in a role and a slot the database allows", () => {
    for (const bundle of bundles) {
      expect(bundle.members.length, bundle.slug).toBeGreaterThanOrEqual(2);
      for (const entry of bundle.members) {
        expect(designs.has(entry.templateSlug), `${bundle.slug}: ${entry.templateSlug}`).toBe(true);
        expect(BUNDLE_ROLES).toContain(entry.role);
        expect(BUNDLE_SLOTS).toContain(entry.slot);
      }
    }
  });

  it("numbers the members from one, with no number and no role-and-slot pair twice", () => {
    for (const bundle of bundles) {
      expect(bundle.members.map((entry) => entry.position)).toEqual(bundle.members.map((_entry, index) => index + 1));
      const pairs = bundle.members.map((entry) => `${entry.role}/${entry.slot}`);
      expect(new Set(pairs).size, bundle.slug).toBe(pairs.length);
    }
  });

  it("holds a shirt or a base layer and something for the legs in every bundle", () => {
    for (const bundle of bundles) {
      const slots = bundle.members.map((entry) => entry.slot);
      expect(slots.some((slot) => slot === "shirt" || slot === "base-layer" || slot === "hoodie"), bundle.slug).toBe(true);
      expect(slots.some((slot) => slot === "shorts" || slot === "trousers"), bundle.slug).toBe(true);
    }
  });

  it("takes its sport, colour family and tags from its lead design, so it cannot disagree with it", () => {
    for (const bundle of bundles) {
      const lead = designs.get(bundle.members[0]!.templateSlug)!;
      expect(bundle.sport, bundle.slug).toBe(lead.sport);
      expect(bundle.colourFamily, bundle.slug).toBe(lead.colourFamily);
      expect(matchesTags({ sport: bundle.sportTags, style: lead.styleTags, era: bundle.eraTags, mood: bundle.moodTags, colour: bundle.colourFamily }, { colour: lead.colourFamily })).toBe(true);
    }
  });

  it("covers the football, cricket and training kits, and a gym set", () => {
    const sports = bundles.map((bundle) => bundle.sport);
    for (const sport of ["football", "cricket", "training", "running"]) expect(sports).toContain(sport);
  });

  it("says that it has no socks, and names the gap rule rather than inventing one", () => {
    for (const bundle of bundles) expect(bundle.gaps).toEqual([SOCKS_GAP]);
    expect(SOCKS_GAP.ruleId).toBe(GAP_RULE_ID);
    expect(SOCKS_GAP.line).toContain("socks are not one of the eight base articles");
  });

  it("is a Knitwright starter that no factory has reviewed", () => {
    for (const bundle of bundles) expect(bundle.label).toBe("Knitwright starter, not reviewed by a factory");
  });
});

describe("a bundle that cannot be built", () => {
  it("names the bundle and the design when a member is not in the library", () => {
    expect(() => buildBundles([{ slug: "x", title: "X", members: [{ templateSlug: "no-such-design", role: "home", slot: "shirt" }] }])).toThrow(
      /^x: no design template is called "no-such-design"\.$/,
    );
  });

  it("refuses a bundle with nothing in it", () => {
    expect(() => buildBundles([{ slug: "x", title: "X", members: [] }])).toThrow(/^x: a bundle needs at least one design\.$/);
  });
});

describe("the rows a bundle stores", () => {
  it("writes the bundle with its gaps, each naming its rule", () => {
    const row = bundleRowOf(bundles[0]!);
    expect(row).toMatchObject({ slug: BUNDLE_PLANS[0]!.slug, source: "knitwright" });
    expect(row.gaps).toEqual([{ part: "socks", line: SOCKS_GAP.line, rule_id: GAP_RULE_ID }]);
    expect(row.sport_tags).toEqual([...bundles[0]!.sportTags]);
  });

  it("writes one member row per design, naming the bundle and the design by slug", () => {
    const rows = memberRowsOf(bundles[0]!);
    expect(rows).toHaveLength(bundles[0]!.members.length);
    expect(rows[0]).toEqual({ bundle_slug: bundles[0]!.slug, template_slug: bundles[0]!.members[0]!.templateSlug, role: "home", slot: "shirt", position: 1 });
  });
});
