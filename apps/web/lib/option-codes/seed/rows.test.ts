import { describe, expect, it } from "vitest";
import { catalogue } from "@/lib/catalogue/fixtures/source";
import { typesForBaseArticle } from "@/lib/catalogue";
import { getType } from "@/lib/garment/registry";
import { readCited } from "../fixtures/source";
import { CITED_FILES, OPTION_CODE_MAP_SEED } from "./rows";

/**
 * The map's one rule: a row joins a registry choice to a catalogue code only where a published file says the two
 * are the same thing. These tests read every cited file and every option the catalogue seeds, so a quote that is
 * not really in its file, a code the catalogue does not hold, or a mapped row with no source at all, fails here
 * rather than reaching a factory.
 */

const files: ReadonlyMap<string, string> = new Map(CITED_FILES.map((file) => [file, readCited(file)]));

const article = () => {
  const found = catalogue().find((row) => row.code === "JSY-SS-01");
  if (found === undefined) throw new Error("The catalogue fixture has no JSY-SS-01.");
  return found;
};

const mapped = OPTION_CODE_MAP_SEED.filter((row) => row.kind === "mapped");

describe("every source the map quotes", () => {
  it("is a file in the repository", () => {
    for (const file of CITED_FILES) expect(files.get(file), file).toBeTypeOf("string");
  });

  it("really holds the quote, word for word", () => {
    for (const row of OPTION_CODE_MAP_SEED) {
      for (const source of row.sources) {
        const text = files.get(source.file) ?? "";
        expect(text.includes(source.quote), `${row.registryKey ?? row.optionGroup}/${row.registryChoice ?? "any"}: ${source.file} does not hold "${source.quote}"`).toBe(true);
      }
    }
  });

  it("is a published build-pack file, not one of our own source files", () => {
    for (const file of CITED_FILES) expect(file.startsWith("docs/spec/"), file).toBe(true);
  });
});

describe("every mapped row", () => {
  it("cites at least one source", () => {
    expect(mapped.length).toBeGreaterThan(0);
    for (const row of mapped) expect(row.sources.length, `${row.registryKey}/${row.registryChoice}`).toBeGreaterThan(0);
  });

  it("names a code the catalogue really approved for that article and that group", () => {
    const options = article().options;
    for (const row of mapped) {
      const option = options.find((candidate) => candidate.group === row.optionGroup && candidate.code === row.optionCode);
      expect(option, `${row.optionGroup} ${row.optionCode ?? "null"} is not a seeded option`).toBeDefined();
    }
  });

  it("names a registry choice the registry really offers on one of the article's own types", () => {
    const offered = new Map<string, readonly string[]>();
    for (const typeId of typesForBaseArticle("JSY-SS-01")) {
      for (const option of getType(typeId)?.options ?? []) {
        offered.set(option.id, option.choices.map((choice) => choice.id));
      }
    }
    for (const row of OPTION_CODE_MAP_SEED) {
      if (row.registryKey === null) continue;
      const choices = offered.get(row.registryKey);
      expect(choices, `${row.registryKey} is not an option of this article's registry types`).toBeDefined();
      if (row.registryChoice !== null) expect(choices, row.registryChoice).toContain(row.registryChoice);
    }
  });

  it("carries the rule the catalogue gives that option, so the Why? link resolves", () => {
    const options = article().options;
    for (const row of mapped) {
      const option = options.find((candidate) => candidate.group === row.optionGroup && candidate.code === row.optionCode);
      expect(row.ruleId, `${row.optionCode ?? ""}`).toBe(option?.ruleId);
    }
  });
});

describe("every row with no code", () => {
  it("says why in words, and quotes nothing when nothing published joins the two", () => {
    for (const row of OPTION_CODE_MAP_SEED) {
      if (row.kind === "mapped") {
        expect(row.note, `${row.optionCode ?? ""}`).toBeNull();
        continue;
      }
      expect(row.optionCode, `${row.registryKey ?? ""}`).toBeNull();
      expect((row.note ?? "").length, `${row.registryKey ?? ""}`).toBeGreaterThan(20);
      if (row.kind === "no_code_yet") expect(row.sources, `${row.registryKey ?? ""}`).toEqual([]);
      else expect(row.sources.length, `${row.registryKey ?? ""}`).toBeGreaterThan(0);
    }
  });

  it("carries R-GAP-000 wherever no rule is written for the gap", () => {
    for (const row of OPTION_CODE_MAP_SEED.filter((candidate) => candidate.kind === "no_code_yet")) {
      expect(row.ruleId).toBe("R-GAP-000");
    }
  });
});

describe("the map as a whole", () => {
  it("answers every question the article's own registry types ask", () => {
    const keys = new Set(OPTION_CODE_MAP_SEED.flatMap((row) => (row.registryKey === null ? [] : [row.registryKey])));
    for (const typeId of typesForBaseArticle("JSY-SS-01")) {
      for (const option of getType(typeId)?.options ?? []) expect([...keys], `${typeId} asks about ${option.id}`).toContain(option.id);
    }
  });

  it("answers every choice of a key it binds to a catalogue group", () => {
    const bound = OPTION_CODE_MAP_SEED.filter((row) => row.optionGroup !== null && row.registryKey !== null);
    for (const row of bound) {
      const type = getType(typesForBaseArticle("JSY-SS-01")[0] ?? "");
      const choices = type?.options.find((option) => option.id === row.registryKey)?.choices ?? [];
      for (const choice of choices) {
        const answer = OPTION_CODE_MAP_SEED.find(
          (candidate) => candidate.registryKey === row.registryKey && (candidate.registryChoice === null || candidate.registryChoice === choice.id),
        );
        expect(answer, `${row.registryKey ?? ""} ${choice.id}`).toBeDefined();
      }
    }
  });

  it("holds at most one row per question", () => {
    const keys = OPTION_CODE_MAP_SEED.map((row) => `${row.articleCode}|${row.registryKey ?? ""}|${row.registryChoice ?? ""}|${row.optionGroup ?? ""}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("covers only the one article that has option codes to map", () => {
    expect(new Set(OPTION_CODE_MAP_SEED.map((row) => row.articleCode))).toEqual(new Set(["JSY-SS-01"]));
    for (const row of catalogue()) {
      if (row.code === "JSY-SS-01") continue;
      expect(row.options, row.code).toEqual([]);
    }
  });
});
