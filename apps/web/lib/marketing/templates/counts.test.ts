import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LAUNCH_COUNTS } from "@/lib/templates/kinds";
import { RULE_ID } from "@/lib/rulebook/constants";
import { buildMarketingTemplates } from "./build";
import { LAYOUT_PLANS, buildLayouts } from "./plans";
import { GROUP_LABELS, MARKETING_FORMATS, MARKETING_GROUPS, isMarketingFormat } from "./types";

/**
 * `07`'s own table, read rather than remembered (plan v5 L4). The spec names the groups and the
 * layouts; the launch count of 50 is the row in `07`'s "Template types" table. If either changes,
 * this test fails rather than the library quietly drifting from the spec.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");
const spec = (): string => readFileSync(join(REPO_ROOT, "docs", "spec", "07-template-library.md"), "utf8");

/** The cells of the `07` marketing row whose first cell holds `group`. */
const specRow = (group: string): string => {
  const line = spec()
    .split("\n")
    .find((row) => row.startsWith(`| ${group} |`));
  expect(line, `no row of 07 names the group ${group}`).toBeDefined();
  return line!;
};

/** Each layout of `07`, as the spec writes it, against the key (or keys) this directory builds for it. */
const SPEC_LAYOUTS: readonly Readonly<{ group: string; wording: string; keys: readonly string[] }>[] = [
  { group: "Kit launch", wording: '"New kit" reveal post', keys: ["new-kit-reveal"] },
  { group: "Kit launch", wording: "home/away split", keys: ["home-away-split"] },
  { group: "Kit launch", wording: "kit countdown story (3, 2, 1)", keys: ["kit-countdown-3", "kit-countdown-2", "kit-countdown-1"] },
  { group: "Kit launch", wording: "pre-order now", keys: ["pre-order-now"] },
  { group: "Kit launch", wording: '"Available now" with QR code', keys: ["available-now-qr"] },
  { group: "Club life", wording: "New signing", keys: ["new-signing"] },
  { group: "Club life", wording: "matchday", keys: ["matchday"] },
  { group: "Club life", wording: "result", keys: ["result"] },
  { group: "Club life", wording: "fixtures list", keys: ["fixtures-list"] },
  { group: "Club life", wording: "player of the match", keys: ["player-of-the-match"] },
  { group: "Club life", wording: "sponsor thank-you", keys: ["sponsor-thank-you"] },
  { group: "Club life", wording: "training session announcement", keys: ["training-session"] },
  { group: "Team store", wording: '"Order your kit" with deadline', keys: ["order-your-kit"] },
  { group: "Team store", wording: "size reminder", keys: ["size-reminder"] },
  { group: "Team store", wording: "last chance", keys: ["last-chance"] },
  { group: "Team store", wording: "store closed / kits arriving", keys: ["kits-arriving"] },
  { group: "Brand drop", wording: "Drop announcement", keys: ["drop-announcement"] },
  { group: "Brand drop", wording: "product feature (fabric, fit, features callouts)", keys: ["product-feature"] },
  { group: "Brand drop", wording: "size guide card", keys: ["size-guide-card"] },
  { group: "Brand drop", wording: "founder story", keys: ["founder-story"] },
  { group: "Brand drop", wording: "restock", keys: ["restock"] },
  { group: "E-commerce", wording: "Product listing images (white background, 4:5)", keys: ["listing-white"] },
  { group: "E-commerce", wording: "size chart image", keys: ["size-chart-image"] },
  { group: "E-commerce", wording: "feature callout image", keys: ["feature-callout-image"] },
  // Owner decision 1 keeps the Store out of this platform, so `07`'s "Etsy/Shopify banner" is
  // seeded as a banner for the brand's own page. The layout is the one `07` asks for.
  { group: "E-commerce", wording: "Etsy/Shopify banner", keys: ["web-banner"] },
  { group: "Print", wording: "A4 poster", keys: ["a4-poster"] },
  { group: "Print", wording: "flyer", keys: ["flyer"] },
  { group: "Print", wording: "noticeboard QR poster for the clubhouse", keys: ["noticeboard-qr-poster"] },
];

describe("the marketing templates against 07", () => {
  it("reaches the 50 rows 07 counts, with no slug twice", () => {
    const rows = buildMarketingTemplates();
    expect(rows).toHaveLength(LAUNCH_COUNTS.marketing);
    expect(LAUNCH_COUNTS.marketing).toBe(50);
    expect(new Set(rows.map((row) => row.slug)).size).toBe(rows.length);
  });

  it("builds every layout 07 names, in the group 07 puts it in", () => {
    const layouts = buildLayouts();
    for (const entry of SPEC_LAYOUTS) {
      expect(specRow(entry.group), entry.wording).toContain(entry.wording);
      for (const key of entry.keys) {
        const layout = layouts.find((one) => one.key === key);
        expect(layout, `${entry.wording} -> ${key}`).toBeDefined();
        expect(GROUP_LABELS[layout!.group]).toBe(entry.group);
      }
    }
  });

  it("builds nothing 07 does not name", () => {
    const named = new Set(SPEC_LAYOUTS.flatMap((entry) => entry.keys));
    expect(LAYOUT_PLANS.map((plan) => plan.key).filter((key) => !named.has(key))).toEqual([]);
    expect(named.size).toBe(LAYOUT_PLANS.length);
  });

  it("uses the six groups of 07 and no other", () => {
    expect(new Set(LAYOUT_PLANS.map((plan) => plan.group))).toEqual(new Set(MARKETING_GROUPS));
    for (const label of Object.values(GROUP_LABELS)) expect(specRow(label)).toContain(label);
  });

  it("offers only the formats 07 lists, each the key of an artboard preset row", () => {
    const line = spec()
      .split("\n")
      .find((row) => row.includes("formats: Instagram post"));
    expect(line, "07 no longer lists the formats of a marketing template").toBeDefined();
    for (const format of MARKETING_FORMATS) expect(isMarketingFormat(format)).toBe(true);
    // `07`: Instagram post 1:1 and 4:5, story/reel 9:16, TikTok 9:16, X/Facebook 16:9, A4 print.
    // Story and TikTok are one size, so five preset keys cover the six the spec words.
    expect(MARKETING_FORMATS).toHaveLength(5);
    for (const plan of LAYOUT_PLANS) {
      expect(plan.formats.length, plan.key).toBeGreaterThan(0);
      expect(new Set(plan.formats).size, plan.key).toBe(plan.formats.length);
    }
  });

  it("carries a rule id on every row and every slot, and invents no rule's words", () => {
    for (const row of buildMarketingTemplates()) {
      expect(row.ruleId).toMatch(RULE_ID);
      expect(row.label).toContain("not reviewed by anyone");
      for (const one of row.slots) expect(one.ruleId).toMatch(RULE_ID);
    }
  });

  it("names a text field's character limit on every text slot, as 07 asks", () => {
    for (const layout of buildLayouts()) {
      for (const one of layout.slots.filter((entry) => entry.kind === "text")) {
        expect(one.limit, `${layout.key}/${one.id}`).toBeGreaterThan(0);
        expect(one.style, `${layout.key}/${one.id}`).not.toBeNull();
      }
    }
  });
});
