import { describe, expect, it } from "vitest";
import { articleChoices } from "./library";
import type { TemplateSummary } from "./filters";

const t = (articleId: string): TemplateSummary => ({
  id: articleId,
  slug: articleId,
  title: articleId,
  sport: "football",
  articleId,
  style: "plain",
  styleTags: ["plain"],
  colourFamily: "blue",
  reviewState: "not_reviewed",
});

describe("the garment filter", () => {
  it("lists each garment once, by its name, in alphabetical order", () => {
    const choices = articleChoices([t("polo"), t("crew-tee"), t("polo")]);
    expect(choices.map((choice) => choice.id)).toEqual(["crew-tee", "polo"]);
    expect(choices[0]!.label).toMatch(/tee/i);
  });

  it("keeps an id the registry no longer has, so the filter still works", () => {
    expect(articleChoices([t("retired-thing")])).toEqual([{ id: "retired-thing", label: "retired-thing" }]);
  });

  it("is empty for an empty library", () => {
    expect(articleChoices([])).toEqual([]);
  });
});
