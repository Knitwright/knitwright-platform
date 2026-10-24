import { describe, expect, it } from "vitest";
import { getType, listTypes } from "@/lib/garment";
import { isOffered } from "@/lib/config/launch-garments";
import prompts from "./fixtures/prompts.json";
import { CATEGORIES, fixtureSchema } from "./schema";

const fixtures = fixtureSchema.parse(prompts);
const cases = fixtures.cases;

describe("the intake test set", () => {
  it("holds 200 prompts, none proposed as approved", () => {
    expect(cases).toHaveLength(200);
    expect(fixtures.status).toBe("proposed");
  });

  it("has unique ids and unique prompts", () => {
    expect(new Set(cases.map((c) => c.id)).size).toBe(cases.length);
    expect(new Set(cases.map((c) => c.prompt.toLowerCase())).size).toBe(cases.length);
  });

  it("covers every category and every article in the current registry", () => {
    for (const category of CATEGORIES) expect(cases.some((c) => c.category === category), category).toBe(true);
    const named = new Set(cases.flatMap((c) => (c.expected.kind === "article" ? [c.expected.articleId] : [])));
    for (const type of listTypes()) expect(named.has(type.id), type.id).toBe(true);
  });

  it("only names articles that exist in the registry today", () => {
    for (const c of cases) {
      const ids =
        c.expected.kind === "article"
          ? [c.expected.articleId]
          : c.expected.kind === "ambiguous"
            ? c.expected.candidates
            : c.expected.nearest.articleId === null
              ? []
              : [c.expected.nearest.articleId];
      for (const id of ids) expect(getType(id), `${c.id} ${id}`).toBeDefined();
    }
  });

  it("gives every out-of-catalogue prompt a one-line difference", () => {
    const outside = cases.filter((c) => c.expected.kind === "out-of-catalogue");
    expect(outside.length).toBeGreaterThanOrEqual(30);
    for (const c of outside) {
      if (c.expected.kind !== "out-of-catalogue") continue;
      const line = c.expected.nearest.difference;
      expect(line.trim(), c.id).not.toBe("");
      expect(line, c.id).not.toContain("\n");
    }
  });

  it("answers the football and cricket prompts with articles that exist now", () => {
    const teamwear = cases.filter((c) => c.category === "teamwear");
    expect(teamwear.length).toBeGreaterThanOrEqual(10);
    for (const c of teamwear) {
      expect(c.expected.kind, c.id).toBe("article");
      expect(c.pending_catalogue, c.id).toBeUndefined();
    }
  });

  it("marks only articles the beta does not offer as outside the launch list", () => {
    const notOffered = cases.filter((c) => c.expected.kind === "article" && !isOffered(c.expected.articleId));
    expect(notOffered.length).toBeGreaterThan(0);
    for (const c of notOffered) expect(["leggings", "sports-bra", "compression-top"]).toContain(c.expected.kind === "article" && c.expected.articleId);
  });

  it("writes colours as lower case six digit hex codes", () => {
    for (const c of cases) for (const colour of c.colours ?? []) expect(colour, c.id).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("keeps the set honest about its size: ambiguous cases name at least two candidates", () => {
    for (const c of cases) if (c.expected.kind === "ambiguous") expect(new Set(c.expected.candidates).size, c.id).toBeGreaterThanOrEqual(2);
  });
});
