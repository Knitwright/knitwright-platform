import { describe, expect, it } from "vitest";
import type { ParameterDef as CatalogueParameterDef } from "@/lib/catalogue";
import { createMemoryStore } from "@/lib/moderation/fixtures/memory-store";
import type { Verdict } from "@/lib/moderation/types";
import { catalogueFrom, livePorts, moderationFrom, moderationReader, toValidationParameter, toValidationResult } from "./live-ports";
import type { ModerationTarget } from "./ports";

/**
 * The wave 2 wiring of `ports.ts`: X1's catalogue and X8's moderation behind the two interfaces X4 defined.
 * The catalogue is read through a stand-in for the Supabase client, which answers the one query `getBaseArticle`
 * makes; the moderation side is read through X8's own in-memory store.
 */

const parameter = (over: Partial<CatalogueParameterDef> = {}): CatalogueParameterDef => ({
  key: "body_length_offset",
  type: "range",
  min: -30,
  max: 30,
  step: 10,
  defaultValue: 0,
  enumValues: null,
  unit: "mm",
  affectsPanels: ["front"],
  pomLetters: ["B"],
  ruleId: "R-PAT-004",
  approvedBySampleId: null,
  ...over,
});

const ARTICLE_ROW = {
  code: "JSY-SS-01",
  name: "Short sleeve jersey",
  article_type: "JSY",
  production_class: "A",
  status: "draft",
  sport_tags: ["football"],
  uses: ["teamwear"],
  fit: "regular",
  genders: ["unisex"],
  size_range: ["S", "M", "L"],
  sample_size: "M",
  registry_type_id: "football-shirt",
  data_label: "Knitwright draft v0.1, not reviewed by a factory",
  hs_code: null,
  origin: null,
  source_version: "0.1",
  source_note: null,
  glb_model_key: null,
  uv_panel_map: null,
  parametric_script_id: null,
  parametric_script_version: null,
  seam_allowances_mm: null,
  seam_allowance_rule_id: null,
  thread_needle: null,
  thread_looper: null,
  thread_rule_id: null,
  article_poms: [],
  parameter_defs: [
    { position: 0, key: "body_length_offset", type: "range", min: -30, max: 30, step: 10, default_value: 0, enum_values: null, unit: "mm", affects_panels: ["front"], pom_letters: ["B"], rule_id: "R-PAT-004", approved_by_sample_id: null },
    { position: 1, key: "side_vent", type: "bool", min: null, max: null, step: null, default_value: false, enum_values: null, unit: null, affects_panels: [], pom_letters: [], rule_id: "R-PAT-006", approved_by_sample_id: null },
  ],
  option_defs: [],
  article_construction: [],
  article_fabrics: [],
};

/** Answers the one `from("base_articles").select(...).eq("code", code).maybeSingle()` chain `getBaseArticle` makes. */
function fakeClient(rows: Readonly<Record<string, unknown>> = { "JSY-SS-01": ARTICLE_ROW }) {
  const asked: string[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: (_column: string, code: string) => ({
          maybeSingle: async () => {
            asked.push(code);
            return { data: rows[code] ?? null, error: null };
          },
        }),
      }),
    }),
  };
  return { asked, client: client as never };
}

describe("a catalogue parameter as validation reads it", () => {
  it("takes a range with its step and its rule", () => {
    expect(toValidationParameter(parameter())).toEqual({ key: "body_length_offset", type: "range", min: -30, max: 30, step: 10, ruleId: "R-PAT-004" });
  });

  it("takes a choice and a flag", () => {
    expect(toValidationParameter(parameter({ key: "collar", type: "enum", min: null, max: null, step: null, enumValues: ["C01", "C03"], defaultValue: "C01" }))).toEqual({
      key: "collar",
      type: "enum",
      values: ["C01", "C03"],
      ruleId: "R-PAT-004",
    });
    expect(toValidationParameter(parameter({ key: "side_vent", type: "bool", min: null, max: null, step: null, defaultValue: false }))).toEqual({ key: "side_vent", type: "bool", ruleId: "R-PAT-004" });
  });

  it("keeps a range with no step, which the catalogue allows", () => {
    expect(toValidationParameter(parameter({ step: null }))).toMatchObject({ type: "range", step: null });
  });

  it("drops a row the catalogue's own rules could not have stored, rather than inventing a range or a choice", () => {
    expect(toValidationParameter(parameter({ min: null }))).toBeNull();
    expect(toValidationParameter(parameter({ max: null }))).toBeNull();
    expect(toValidationParameter(parameter({ type: "enum", enumValues: null }))).toBeNull();
    expect(toValidationParameter(parameter({ type: "enum", enumValues: [] }))).toBeNull();
  });
});

describe("the catalogue port", () => {
  it("gives the base article a garment type is made on, with its production class", async () => {
    expect(await catalogueFrom(fakeClient().client).articleForType("football-shirt")).toEqual({ baseArticleCode: "JSY-SS-01", productionClass: "A" });
  });

  it("gives null for a garment type the catalogue does not cover, without reading the database", async () => {
    const { asked, client } = fakeClient();
    expect(await catalogueFrom(client).articleForType("bobble-hat")).toBeNull();
    expect(asked).toEqual([]);
  });

  it("gives null for a type that maps to an article the catalogue has not got", async () => {
    expect(await catalogueFrom(fakeClient({}).client).articleForType("football-shirt")).toBeNull();
  });

  it("gives the approved parameters of an article, mapped to validation's shapes", async () => {
    expect(await catalogueFrom(fakeClient().client).parameterDefs("JSY-SS-01")).toEqual([
      { key: "body_length_offset", type: "range", min: -30, max: 30, step: 10, ruleId: "R-PAT-004" },
      { key: "side_vent", type: "bool", ruleId: "R-PAT-006" },
    ]);
  });

  it("gives null for an article the catalogue does not offer", async () => {
    expect(await catalogueFrom(fakeClient({}).client).parameterDefs("ZZZ-ZZ-01")).toBeNull();
  });

  it("reads one article once, however often a save asks about it", async () => {
    const { asked, client } = fakeClient();
    const catalogue = catalogueFrom(client);
    await catalogue.articleForType("football-shirt");
    await catalogue.parameterDefs("JSY-SS-01");
    expect(asked).toEqual(["JSY-SS-01"]);
  });
});

describe("a kept screening as validation reads it", () => {
  it("reads the automatic result while nobody has decided", () => {
    expect(toValidationResult({ targetId: "a", result: "flagged", decision: null })).toBe("flagged");
    expect(toValidationResult({ targetId: "a", result: "blocked", decision: null })).toBe("blocked");
    expect(toValidationResult({ targetId: "a", result: "clear", decision: null })).toBe("clear");
  });

  it("lets a person's decision win over it, either way", () => {
    expect(toValidationResult({ targetId: "a", result: "blocked", decision: "allowed" })).toBe("clear");
    expect(toValidationResult({ targetId: "a", result: "clear", decision: "blocked" })).toBe("blocked");
  });
});

describe("the moderation port", () => {
  const target = (id: string, kind: ModerationTarget["kind"] = "asset"): ModerationTarget => ({ kind, id, label: `Picture ${id}` });
  const verdict = (result: Verdict["result"]): Verdict => ({ result, reasons: [] });

  it("answers nothing when the design uses nothing that is screened", async () => {
    const { store } = createMemoryStore();
    expect(await moderationReader(store).statusesFor("brand-1", [])).toEqual([]);
  });

  it("leaves out a target with no screening, and keeps the order it was asked in", async () => {
    const { store } = createMemoryStore();
    await store.record({ brandId: "brand-1", userId: null, targetKind: "asset", targetId: "b", hook: "upload", label: "Crest", subjectSha256: null, verdict: verdict("flagged") });

    const statuses = await moderationReader(store).statusesFor("brand-1", [target("a"), target("b"), target("c")]);

    expect(statuses).toEqual([{ target: target("b"), result: "flagged" }]);
  });

  it("reads the newest screening of each target, and tells an asset from a text of the same id", async () => {
    const { store } = createMemoryStore();
    const keep = { brandId: "brand-1", userId: null, hook: "upload" as const, label: "Crest", subjectSha256: null };
    await store.record({ ...keep, targetKind: "asset", targetId: "same", verdict: verdict("blocked") });
    await store.record({ ...keep, targetKind: "asset", targetId: "same", verdict: verdict("clear") });
    await store.record({ ...keep, targetKind: "text", targetId: "same", verdict: verdict("flagged") });

    expect(await moderationReader(store).statusesFor("brand-1", [target("same"), target("same", "text")])).toEqual([
      { target: target("same"), result: "clear" },
      { target: target("same", "text"), result: "flagged" },
    ]);
  });

  it("reads a person's decision, so an allowed picture stops raising a finding", async () => {
    const { store, checks, decide } = createMemoryStore();
    await store.record({ brandId: "brand-1", userId: null, targetKind: "asset", targetId: "a", hook: "upload", label: "Crest", subjectSha256: null, verdict: verdict("flagged") });
    decide(checks[0]!.id, "allowed");

    expect(await moderationReader(store).statusesFor("brand-1", [target("a")])).toEqual([{ target: target("a"), result: "clear" }]);
  });
});

describe("both ports over the server's own client", () => {
  it("are an article catalogue and a moderation reader", () => {
    const ports = livePorts(fakeClient().client);
    expect(typeof ports.catalogue.articleForType).toBe("function");
    expect(typeof ports.moderation.statusesFor).toBe("function");
    expect(typeof moderationFrom(fakeClient().client).statusesFor).toBe("function");
  });
});
