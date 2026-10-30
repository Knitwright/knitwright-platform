import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { draftAllSizes, draftArticle, scriptFor } from "../registry";
import { needsBeforeDrafting, notDraftedReason, notDraftedSource, SEEDED_NOT_DRAFTED } from "./index";

/** The repository root, from apps/web/lib/parametric/articles. */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..", "..");

const read = (path: string): string => readFileSync(join(REPO_ROOT, path), "utf8");

const briefOf = (code: string): { name: string; parametric_script: Record<string, unknown> } =>
  JSON.parse(read(`docs/spec/articles/${code}/article.json`)) as { name: string; parametric_script: Record<string, unknown> };

/** The codes of ONBOARDING.md's launch table, in its order. */
const launchCodes = (): readonly string[] =>
  [...read("docs/spec/articles/ONBOARDING.md").matchAll(/^\| \d \| [^|]+ \| `([A-Z0-9-]+)` \|/gm)].map((match) => match[1]!);

describe("the register of articles that are not drafted", () => {
  it("covers every launch article with no drafting script, and only those", () => {
    const codes = launchCodes();
    expect(codes).toHaveLength(8);
    expect(SEEDED_NOT_DRAFTED.all().map((article) => article.code)).toEqual(codes.filter((code) => !scriptFor(code)));
    expect(SEEDED_NOT_DRAFTED.get("JSY-SS-01")).toBeNull();
  });

  it("says the same as the article's own brief, so the two cannot drift", () => {
    for (const article of SEEDED_NOT_DRAFTED.all()) {
      const brief = briefOf(article.code);
      expect([article.name, article.status, article.reason, article.rule, article.needs]).toEqual([
        brief.name,
        brief.parametric_script.status,
        brief.parametric_script.reason,
        brief.parametric_script.rule,
        brief.parametric_script.needs,
      ]);
    }
  });

  it("gives the reason and the measures the drafter would need", () => {
    expect(notDraftedReason("SHO-TR-01")).toBe(
      "Not drafted yet: Football/training shorts has no point of measure from a factory and no block on file, so there " +
        "is nothing to draft from; a drafted shape nobody has measured is an invented measurement.",
    );
    expect(needsBeforeDrafting("SHO-TR-01")).toContain("inseam");
    expect(needsBeforeDrafting("CMP-LS-01")).toContain("chest width");
  });

  it("answers nothing for an article it has no entry for", () => {
    expect(notDraftedReason("JSY-SS-01")).toBeNull();
    expect(needsBeforeDrafting("ZZZ-ZZ-01")).toEqual([]);
  });

  it("can be replaced by a factory's own register", () => {
    const own = notDraftedSource([
      { code: "TEE-TR-01", name: "Training tee", status: "not drafted yet", reason: "the block is being measured", rule: "R-PAT-401", needs: ["chest width"] },
    ]);
    expect(notDraftedReason("TEE-TR-01", own)).toBe("Not drafted yet: the block is being measured");
    expect(notDraftedReason("SHO-TR-01", own)).toBeNull();
  });
});

describe("drafting an article in the register", () => {
  it("is refused, in every size, without any geometry being invented", () => {
    for (const article of SEEDED_NOT_DRAFTED.all()) {
      const one = draftArticle(article.code, "M");
      const all = draftAllSizes(article.code);
      expect([one.kind, all.kind]).toEqual(["not-drafted-yet", "not-drafted-yet"]);
      expect(one.kind === "not-drafted-yet" && one.reason).toContain("Not drafted yet");
    }
  });
});
