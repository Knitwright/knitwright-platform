import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DRAFT_LABEL } from "../vocabulary";
import {
  baseArticleFromDraftJson,
  BRIEF_LABEL,
  BUNDLED_DRAFT_ARTICLES,
  citedFields,
  DRAFT_CODES,
  draftArticleByCode,
  draftArticleSchema,
  NOT_DRAFTED_YET,
  uncitedFields,
} from "./draft-article";

/** The repository root, from apps/web/lib/catalogue/seed. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const readJson = (path: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(REPO_ROOT, path), "utf8")) as Record<string, unknown>;

const brief = (code: string): Record<string, unknown> => readJson(`docs/spec/articles/${code}/article.json`);

const bundleFile = (): { note: string; articles: Record<string, unknown>[] } =>
  readJson("apps/web/lib/catalogue/seed/data/draft-articles.json") as { note: string; articles: Record<string, unknown>[] };

const withField = (code: string, field: string, value: unknown): unknown => ({ ...brief(code), [field]: value });

describe("the brief of an article with no factory block", () => {
  it("is on file for each of the seven, parses, and is labelled Knitwright's unreviewed draft", () => {
    for (const code of DRAFT_CODES) {
      const draft = draftArticleSchema.parse(brief(code));
      expect([draft.code, draft.label, draft.status]).toEqual([code, BRIEF_LABEL, "draft_no_factory_block"]);
    }
  });

  it("holds an empty table of points of measure, because nothing published measures these garments", () => {
    for (const draft of BUNDLED_DRAFT_ARTICLES) {
      expect([draft.pom, draft.parameters, draft.construction, Object.keys(draft.options)]).toEqual([[], [], [], []]);
      expect([draft.sizes, draft.base_size, draft.hs_code, draft.origin]).toEqual([[], null, null, null]);
    }
  });

  it("says the article is not drafted yet, with the reason, the rule and the measures a drafter would need", () => {
    for (const draft of BUNDLED_DRAFT_ARTICLES) {
      expect(draft.parametric_script.status).toBe(NOT_DRAFTED_YET);
      expect(draft.parametric_script.reason).toContain("no block on file");
      expect(draft.parametric_script.rule).toMatch(/^R-PAT-\d01$/);
      expect(draft.parametric_script.needs.length).toBeGreaterThan(3);
    }
  });

  it("cites every value it holds", () => {
    for (const draft of BUNDLED_DRAFT_ARTICLES) expect([draft.code, uncitedFields(draft)]).toEqual([draft.code, []]);
  });

  it("names a source for every citation and a caveat for every candidate value", () => {
    for (const draft of BUNDLED_DRAFT_ARTICLES) {
      for (const source of draft.sources) expect(source.source).toMatch(/docs\/spec\//);
      for (const candidate of draft.candidates) expect([candidate.source, candidate.caveat]).not.toContain("");
    }
  });

  it("asks the factory and the owner what is missing instead of filling it in", () => {
    for (const draft of BUNDLED_DRAFT_ARTICLES) {
      expect(draft.open_questions.length).toBeGreaterThan(3);
      expect(draft.open_questions.join(" ")).toContain("POM table");
    }
  });
});

describe("the bundled copies of the briefs", () => {
  it("are the committed briefs, in onboarding order", () => {
    const bundle = bundleFile();
    expect(bundle.articles.map((article) => article.code)).toEqual([...DRAFT_CODES]);
    for (const [index, code] of DRAFT_CODES.entries()) expect(bundle.articles[index]).toEqual(brief(code));
  });

  it("say where they came from and that they are not edited by hand", () => {
    expect(bundleFile().note).toContain("print-draft-articles.mts");
  });
});

describe("the catalogue article a brief describes", () => {
  it("carries the code, name, class, uses, sports and fabric programme code, and nothing else", () => {
    const shorts = baseArticleFromDraftJson(draftArticleSchema.parse(brief("SHO-TR-01")));
    expect(shorts).toEqual({
      code: "SHO-TR-01",
      name: "Football/training shorts",
      articleType: "SHO",
      productionClass: "A",
      status: "draft",
      sportTags: ["football", "training"],
      uses: ["teamwear", "studio"],
      fit: null,
      genders: [],
      sizeRange: [],
      sampleSize: null,
      registryTypeId: "football-shorts",
      dataLabel: DRAFT_LABEL,
      hsCode: null,
      origin: null,
      sourceVersion: null,
      sourceNote: null,
      glbModelKey: null,
      uvPanelMap: null,
      parametricScriptId: null,
      parametricScriptVersion: null,
      seamAllowances: null,
      thread: null,
      poms: [],
      parameters: [],
      options: [],
      construction: [],
      fabrics: [
        {
          code: "F-POLY-INT",
          role: null,
          description: null,
          gsm: null,
          widthCm: null,
          pressShrinkLengthPct: null,
          pressShrinkWidthPct: null,
          sourceNote: null,
        },
      ],
    });
  });

  it("leaves every illustrative value behind: not one reaches the catalogue", () => {
    const shorts = draftArticleSchema.parse(brief("SHO-TR-01"));
    // The build pack's own illustrative waist and inseam figures, and the size run of the same CSV.
    expect(JSON.stringify(shorts.candidates)).toContain("380");
    const row = JSON.stringify(baseArticleFromDraftJson(shorts));
    for (const illustrative of ["380", "127", "3XL", "micro-mesh", "zip_back", "inseam"]) {
      expect(row, `the catalogue row must not hold ${illustrative}`).not.toContain(illustrative);
    }
  });

  it("is one article per brief, found by its code", () => {
    expect(draftArticleByCode("HOD-ST-01")?.name).toBe("Hoodie, stock-colour fleece");
    expect(draftArticleByCode("JSY-SS-01")).toBeNull();
  });
});

describe("the citation gate", () => {
  it("asks for a citation for every value a brief gains", () => {
    const filled = draftArticleSchema.parse({
      ...brief("CRK-SS-01"),
      sizes: ["S", "M", "L"],
      base_size: "M",
      hs_code: "6105.10",
      origin: "PK",
    });
    expect(citedFields(filled)).toContain("sizes");
    expect(uncitedFields(filled)).toEqual(["sizes", "base_size", "hs_code", "origin"]);
  });

  it("counts a fabric role only when the brief names one", () => {
    const noFabric = draftArticleSchema.parse({ ...brief("CRK-SS-01"), fabrics: {} });
    expect(citedFields(noFabric)).not.toContain("fabrics.body.code");
    expect(uncitedFields(noFabric)).toEqual([]);
  });
});

describe("a brief the schema refuses", () => {
  const refused: readonly [string, unknown][] = [
    ["a point of measure with no factory behind it", withField("TEE-TR-01", "pom", [{ letter: "A" }])],
    ["a parameter range nobody approved", withField("TEE-TR-01", "parameters", [{ key: "body_length_offset" }])],
    ["an option with no rule", withField("TEE-TR-01", "options", { collar: [{ code: "C01" }] })],
    ["a construction row the factory has not given", withField("TEE-TR-01", "construction", [{ n: 1 }])],
    ["a label that does not say the draft is unreviewed", withField("TEE-TR-01", "label", "Knitwright v1.0")],
    ["a status that claims a factory has seen it", withField("TEE-TR-01", "status", "draft_for_factory_review")],
    ["a drafting script it does not have", withField("TEE-TR-01", "parametric_script", { status: "drafted" })],
    ["a value with no citation list at all", withField("TEE-TR-01", "sources", [])],
    ["no question left to ask", withField("TEE-TR-01", "open_questions", [])],
    ["a fabric that is not a programme code", withField("TEE-TR-01", "fabrics", { body: { code: "cotton" } })],
    ["a measurement in inches", withField("TEE-TR-01", "units", "in")],
  ];

  for (const [reason, input] of refused) {
    it(`refuses ${reason}`, () => {
      expect(draftArticleSchema.safeParse(input).success).toBe(false);
    });
  }
});
