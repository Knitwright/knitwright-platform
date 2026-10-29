import { describe, expect, it } from "vitest";
import { confirmSchema, explainSchema, parseArticleCodes, ruleInputSchema } from "./input";

const typed = {
  ruleId: " r-sub-009 ",
  topic: "print",
  articleCodes: "jsy-ss-01, JSY-LS-01  jsy-ss-01",
  title: "Fine detail",
  rule: "A rule",
  body: "Why it is so",
  bestPractice: "What to do",
  source: "factory",
  sourceNote: " Factory to confirm ",
};

describe("ruleInputSchema", () => {
  it("tidies what was typed", () => {
    expect(ruleInputSchema.parse(typed)).toEqual({
      ruleId: "R-SUB-009",
      topic: "print",
      articleCodes: ["JSY-SS-01", "JSY-LS-01"],
      title: "Fine detail",
      rule: "A rule",
      body: "Why it is so",
      bestPractice: "What to do",
      source: "factory",
      sourceNote: "Factory to confirm",
    });
  });

  it("takes no article codes as every article, and no note as empty", () => {
    const { articleCodes, sourceNote } = ruleInputSchema.parse({ ...typed, articleCodes: undefined, sourceNote: undefined });
    expect([articleCodes, sourceNote]).toEqual([[], ""]);
  });

  it("answers in words for each thing it refuses", () => {
    const message = (over: Record<string, unknown>) => ruleInputSchema.safeParse({ ...typed, ...over }).error?.issues[0]?.message;
    expect(message({ ruleId: "SUB-9" })).toBe("Use the form R-SUB-004.");
    expect(message({ topic: "colour" })).toBe("Choose a topic.");
    expect(message({ source: "someone" })).toBe("Choose a source.");
    expect(message({ articleCodes: "JSY_SS_01!" })).toBe("Article codes look like JSY-SS-01.");
    expect(message({ title: "  " })).toBe("Write the applies-to line.");
    expect(message({ body: "x".repeat(2001) })).toBe("The why is too long.");
  });
});

describe("the other inputs", () => {
  it("reads a version from a form as a number", () => {
    expect(confirmSchema.parse({ ruleId: "R-SUB-004", version: "2" })).toEqual({ ruleId: "R-SUB-004", version: 2 });
    expect(confirmSchema.safeParse({ ruleId: "R-SUB-004", version: "0" }).success).toBe(false);
  });

  it("takes any short id to explain, so an unknown one can be logged", () => {
    expect(explainSchema.parse({ ruleId: "R-NONE-999" })).toEqual({ ruleId: "R-NONE-999", context: "" });
    expect(explainSchema.safeParse({ ruleId: "" }).success).toBe(false);
  });

  it("splits article codes on commas and spaces, once each", () => {
    expect(parseArticleCodes(" , ")).toEqual([]);
  });
});
