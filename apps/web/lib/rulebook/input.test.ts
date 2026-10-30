import { describe, expect, it } from "vitest";
import { confirmSchema, explainSchema, parseArticleCodes, parseMethods, ruleInputSchema } from "./input";

const typed = {
  ruleId: " r-sub-009 ",
  topic: "print",
  articleCodes: "jsy-ss-01, JSY-LS-01  jsy-ss-01",
  methods: " Sublimation sublimation ",
  scopeNote: " scope not reviewed by a factory ",
  title: "Fine detail",
  rule: "A rule",
  body: "Why it is so",
  bestPractice: "What to do",
  source: "knitwright",
  sourceNote: " Factory to confirm ",
};

describe("ruleInputSchema", () => {
  it("tidies what was typed", () => {
    expect(ruleInputSchema.parse(typed)).toEqual({
      ruleId: "R-SUB-009",
      topic: "print",
      articleCodes: ["JSY-SS-01", "JSY-LS-01"],
      methods: ["sublimation"],
      scopeNote: "scope not reviewed by a factory",
      title: "Fine detail",
      rule: "A rule",
      body: "Why it is so",
      bestPractice: "What to do",
      source: "knitwright",
      sourceNote: "Factory to confirm",
    });
  });

  it("takes no method and no note as empty, as long as the rule still names an article", () => {
    const { methods, scopeNote, sourceNote } = ruleInputSchema.parse({ ...typed, methods: undefined, scopeNote: undefined, sourceNote: undefined });
    expect([methods, scopeNote, sourceNote]).toEqual([[], "", ""]);
  });

  it("refuses a source filed as the factory that the factory did not say (owner decision 13)", () => {
    const refused = ruleInputSchema.safeParse({ ...typed, source: "factory" });
    expect(refused.error?.issues[0]).toMatchObject({
      message: "That note does not say the factory told us this. File it under whoever did.",
      path: ["source"],
    });
    expect(ruleInputSchema.safeParse({ ...typed, source: "factory", sourceNote: "Factory price list" }).success).toBe(true);
  });

  it("refuses a rule that names neither an article nor a method, because that claims every article", () => {
    const refused = ruleInputSchema.safeParse({ ...typed, articleCodes: "", methods: "" });
    expect(refused.error?.issues[0]).toMatchObject({ message: "Name the articles or the methods this rule covers.", path: ["articleCodes"] });
    expect(ruleInputSchema.safeParse({ ...typed, articleCodes: "" }).success).toBe(true);
  });

  it("answers in words for each thing it refuses", () => {
    const message = (over: Record<string, unknown>) => ruleInputSchema.safeParse({ ...typed, ...over }).error?.issues[0]?.message;
    expect(message({ ruleId: "SUB-9" })).toBe("Use the form R-SUB-004.");
    expect(message({ topic: "colour" })).toBe("Choose a topic.");
    expect(message({ source: "someone" })).toBe("Choose a source.");
    expect(message({ articleCodes: "JSY_SS_01!" })).toBe("Article codes look like JSY-SS-01.");
    expect(message({ methods: "Sublimation!" })).toBe("A method looks like sublimation.");
    expect(message({ title: "  " })).toBe("Write the applies-to line.");
    expect(message({ body: "x".repeat(2001) })).toBe("The why is too long.");
  });
});

describe("the other inputs", () => {
  it("reads a version from a form as a number, with the person who reviewed the rule", () => {
    const person = { confirmedName: " Ana Lima ", confirmedRole: " pattern master " };
    expect(confirmSchema.parse({ ruleId: "R-SUB-004", version: "2", ...person })).toEqual({
      ruleId: "R-SUB-004",
      version: 2,
      confirmedName: "Ana Lima",
      confirmedRole: "pattern master",
    });
    expect(confirmSchema.safeParse({ ruleId: "R-SUB-004", version: "0", ...person }).success).toBe(false);
  });

  it("refuses a confirmation by nobody in particular (owner decision 14)", () => {
    const refuse = (over: Record<string, unknown>) =>
      confirmSchema.safeParse({ ruleId: "R-SUB-004", version: "1", confirmedName: "Ana Lima", confirmedRole: "pattern master", ...over });
    expect(refuse({ confirmedName: "  " }).error?.issues[0]?.message).toBe("Write the name of the factory person who reviewed the rule.");
    expect(refuse({ confirmedRole: "" }).error?.issues[0]?.message).toBe("Write the role of the factory person, for example pattern master.");
    expect(refuse({ confirmedName: undefined }).success).toBe(false);
  });

  it("takes any short id to explain, so an unknown one can be logged", () => {
    expect(explainSchema.parse({ ruleId: "R-NONE-999" })).toEqual({ ruleId: "R-NONE-999", context: "" });
    expect(explainSchema.safeParse({ ruleId: "" }).success).toBe(false);
  });

  it("splits article codes and methods on commas and spaces, once each", () => {
    expect(parseArticleCodes(" , ")).toEqual([]);
    expect(parseMethods(" , ")).toEqual([]);
    expect(parseMethods("sublimation, Embroidery sublimation")).toEqual(["sublimation", "embroidery"]);
  });
});
