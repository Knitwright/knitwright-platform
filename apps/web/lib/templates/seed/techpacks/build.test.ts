import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { GAP_RULE_ID, RULE_ID } from "@/lib/rulebook/constants";
import { SECTION_IDS } from "@/lib/techpack/types";
import { LAUNCH_COUNTS } from "../../kinds";
import { buildTechpackTemplate, buildTechpackTemplates, techpackRowOf } from "./build";
import { ARTICLES_WITH_GAP_RULES, GAP_KINDS, ruleForGap } from "./rules";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..", "..");
const rulebookOf = (code: string): string => readFileSync(join(REPO_ROOT, "docs", "spec", "articles", code, "rulebook.md"), "utf8");

const articles = catalogue();
const templates = buildTechpackTemplates(articles);
const byCode = new Map(templates.map((template) => [template.baseArticleCode, template]));

describe("the tech pack templates at launch", () => {
  it("are the 8 that 07 asks for, one per base article", () => {
    expect(templates).toHaveLength(LAUNCH_COUNTS.techpack);
    expect(templates.map((template) => template.baseArticleCode)).toEqual(articles.map((article) => article.code));
    expect(new Set(templates.map((template) => template.slug)).size).toBe(templates.length);
  });

  it("names each one after its article and carries that article's own label", () => {
    for (const article of articles) {
      const template = byCode.get(article.code)!;
      expect(template.slug).toBe(`techpack-${article.code.toLowerCase()}`);
      expect(template.title).toContain(article.name);
      expect(template.label).toBe(article.dataLabel);
    }
  });

  it("lists its pages in the tech pack's own order and holds no page twice", () => {
    for (const template of templates) {
      expect(template.sections).toEqual(SECTION_IDS.filter((id) => template.sections.includes(id)));
      expect(new Set(template.sections).size).toBe(template.sections.length);
      expect(template.sections.length).toBeGreaterThan(0);
    }
  });

  it("gives the worked article every page, and the one open item it still has", () => {
    const jersey = byCode.get("JSY-SS-01")!;

    expect(jersey.sections).toEqual([...SECTION_IDS]);
    expect(jersey.gaps.map((entry) => entry.ruleId)).toEqual([GAP_RULE_ID]);
    expect(jersey.gaps[0]!.missing).toContain("no master pattern from the factory on file");
  });

  it("refuses the measurement, pattern and construction pages of the seven articles with no data, naming the gap", () => {
    for (const code of ARTICLES_WITH_GAP_RULES) {
      const template = byCode.get(code)!;
      expect(template.sections, code).not.toContain("measurements");
      expect(template.sections, code).not.toContain("how-to-measure");
      expect(template.sections, code).not.toContain("pattern-and-cutting");
      expect(template.sections, code).not.toContain("construction");
      expect(template.sections, code).not.toContain("operations");
      const gaps = template.gaps.map((entry) => `${entry.section}:${entry.ruleId}`);
      expect(gaps, code).toContain(`measurements:${ruleForGap(code, "poms")}`);
      expect(gaps, code).toContain(`pattern-and-cutting:${ruleForGap(code, "pattern")}`);
      expect(gaps, code).toContain(`construction:${ruleForGap(code, "construction")}`);
    }
  });

  it("still gives those seven the pages their own data fills", () => {
    for (const code of ARTICLES_WITH_GAP_RULES) {
      const template = byCode.get(code)!;
      for (const page of ["cover", "readiness", "fabric", "colourways", "labelling", "sign-off"]) expect(template.sections, code).toContain(page);
    }
  });

  it("says the fight shorts have no drawing either, because no garment type stands behind them", () => {
    const fight = byCode.get("FSH-MM-01")!;

    expect(fight.sections).not.toContain("flats");
    expect(fight.gaps.find((entry) => entry.section === "flats")!.ruleId).toBe(GAP_RULE_ID);
    expect(fight.defaults.registry_type).toBeUndefined();
  });

  it("gives every gap a section title, a sentence and a rule id", () => {
    for (const template of templates) {
      for (const entry of template.gaps) {
        expect(entry.sectionTitle.length, template.slug).toBeGreaterThan(0);
        expect(entry.missing.length, template.slug).toBeGreaterThan(10);
        expect(entry.ruleId, `${template.slug}: ${entry.section}`).toMatch(RULE_ID);
      }
    }
  });
});

describe("the default fields", () => {
  it("come from the article's row, and leave out what the article does not have", () => {
    const jersey = byCode.get("JSY-SS-01")!;
    expect(jersey.defaults).toMatchObject({ base_article: "JSY-SS-01", production_class: "A", hs_code: "6110.30" });
    expect(jersey.defaults.size_range).toEqual(["XS", "S", "M", "L", "XL", "2XL", "3XL"]);

    const shorts = byCode.get("SHO-TR-01")!;
    expect(shorts.defaults.size_range).toBeUndefined();
    expect(shorts.defaults.sample_size).toBeUndefined();
    expect(shorts.defaults.hs_code).toBeUndefined();
  });

  it("names which points of measure the pages have, and no measurement at all", () => {
    const jersey = byCode.get("JSY-SS-01")!;
    const letters = jersey.defaults.pom_letters as readonly string[];

    expect(letters.length).toBeGreaterThan(0);
    for (const letter of letters) expect(letter).not.toMatch(/\d{3}/);
    expect(JSON.stringify(byCode.get("HOD-ST-01")!.defaults)).not.toMatch(/\d{3,}/);
  });

  it("has no point of measure for an article that publishes none", () => {
    for (const code of ARTICLES_WITH_GAP_RULES) expect(byCode.get(code)!.defaults.pom_letters, code).toBeUndefined();
  });
});

describe("the rule behind each gap", () => {
  it("is published in that article's own rulebook, never written here", () => {
    for (const code of ARTICLES_WITH_GAP_RULES) {
      const text = rulebookOf(code);
      for (const kind of ["poms", "pattern", "construction"] as const) {
        const ruleId = ruleForGap(code, kind);
        expect(ruleId, `${code} ${kind}`).toMatch(RULE_ID);
        expect(text, `${code} ${kind}: ${ruleId}`).toContain(ruleId);
      }
    }
  });

  it("covers the seven articles with no data and no other", () => {
    expect([...ARTICLES_WITH_GAP_RULES].sort()).toEqual(articles.map((article) => article.code).filter((code) => code !== "JSY-SS-01").sort());
  });

  it("gives no two articles the same rule, and no one article the same rule twice", () => {
    const all = ARTICLES_WITH_GAP_RULES.flatMap((code) => (["poms", "pattern", "construction"] as const).map((kind) => ruleForGap(code, kind)));
    expect(new Set(all).size).toBe(all.length);
  });

  it("uses the gap rule where no entry fits: a missing drawing and a missing fabric", () => {
    for (const kind of GAP_KINDS.filter((entry) => entry === "drawing" || entry === "fabric")) {
      expect(ruleForGap("SHO-TR-01", kind)).toBe(GAP_RULE_ID);
    }
    expect(ruleForGap("JSY-SS-01", "poms")).toBe(GAP_RULE_ID);
  });
});

describe("the row a tech pack template stores", () => {
  it("writes the pages, the defaults and the gaps with their rule ids", () => {
    const row = techpackRowOf(byCode.get("CMP-LS-01")!);

    expect(row).toMatchObject({ slug: "techpack-cmp-ls-01", base_article_code: "CMP-LS-01", source: "knitwright" });
    expect(row.sections).toContain("cover");
    expect(row.gaps.some((entry) => entry.rule_id === "R-FIT-601")).toBe(true);
    expect(row.gaps.every((entry) => entry.section_title.length > 0)).toBe(true);
  });

  it("builds one template from one article, so a new article needs no change here", () => {
    const article = articles.find((entry) => entry.code === "TEE-TR-01")!;
    expect(buildTechpackTemplate(article)).toEqual(byCode.get("TEE-TR-01"));
  });
});
