import { describe, expect, it } from "vitest";
import { articleBook } from "@/lib/teamwear/fixtures/kit";
import { crestFileFixture, crestPixels } from "./fixtures/crests";
import { BAD_COLOUR, NOTHING_GIVEN, readIntake } from "./intake";
import { paletteOf, runCrestToKit, withinKitBudget } from "./service";
import { CREST_LIMITS, feelById, FEEL_DEFINITIONS, FEELS, GAP_RULE_ID, KIT_ROLES, ROLE_CHOICES, ROLE_LABELS, rolesOf, RULES, SETTINGS_LABEL } from "./settings";
import { fixedRanking } from "./rank";

const articles = articleBook();

const form = (extra: Record<string, unknown> = {}) => ({ sportId: "football", roles: "all", feel: "modern", ...extra });

describe("what the screen asks for", () => {
  it("reads a sport, roles, a feel and an optional club name", () => {
    const read = readIntake(form({ clubName: "  Sialkot Rovers " }), true);
    expect(read).toEqual({ ok: true, input: { sportId: "football", roles: "all", feel: "modern", clubName: "Sialkot Rovers", colours: [] } });
  });

  it("treats an empty club name as none, rather than an empty heading", () => {
    expect(readIntake(form({ clubName: "" }), true)).toMatchObject({ ok: true, input: { clubName: null } });
    expect(readIntake(form(), true)).toMatchObject({ ok: true, input: { clubName: null } });
  });

  it("takes at most three colours, lower cased", () => {
    const read = readIntake(form({ colour: ["#1B2A49", "#D4AF37", "#C8102E"] }), false);
    expect(read).toMatchObject({ ok: true, input: { colours: ["#1b2a49", "#d4af37", "#c8102e"] } });
    expect(CREST_LIMITS.maxPickedColours).toBe(3);
  });

  it("refuses a colour that is not one, and says to pick it again", () => {
    expect(readIntake(form({ colour: ["puce"] }), false)).toEqual({ ok: false, errors: [BAD_COLOUR] });
  });

  it("asks for a crest or a colour when it has neither", () => {
    expect(readIntake(form(), false)).toEqual({ ok: false, errors: [NOTHING_GIVEN] });
  });

  it("refuses a sport, a role or a feel it does not offer", () => {
    expect(readIntake(form({ sportId: "quidditch" }), true).ok).toBe(false);
    expect(readIntake(form({ roles: "reserves" }), true).ok).toBe(false);
    expect(readIntake(form({ feel: "loud" }), true).ok).toBe(false);
  });
});

describe("the settings and tables", () => {
  it("offers the four feels and the four role choices the specification names", () => {
    expect(FEELS).toEqual(["classic", "modern", "bold", "plain"]);
    expect(FEEL_DEFINITIONS.map((feel) => feel.id)).toEqual([...FEELS]);
    expect(ROLE_CHOICES).toEqual(["home", "away", "gk", "all"]);
    expect(rolesOf("all")).toEqual(KIT_ROLES);
    expect(rolesOf("gk")).toEqual(["gk"]);
    for (const choice of ROLE_CHOICES) expect(ROLE_LABELS[choice]).toBeTruthy();
  });

  it("labels every feel as Knitwright's own, and falls back to the first for one nobody named", () => {
    for (const feel of FEEL_DEFINITIONS) {
      expect(feel.dataLabel).toBe(SETTINGS_LABEL);
      expect(feel.hint).toMatch(/\.$/);
    }
    expect(feelById(null).id).toBe("classic");
    expect(feelById("loud").id).toBe("classic");
  });

  it("cites a rulebook entry for every rule it applies, and a gap id where none exists", () => {
    for (const ruleId of Object.values(RULES)) expect(ruleId).toMatch(/^R-[A-Z]+-[0-9]{3}$/);
    expect(Object.values(RULES)).not.toContain(GAP_RULE_ID);
    expect(GAP_RULE_ID).toBe("R-GAP-000");
  });
});

describe("the whole run", () => {
  const crest = crestFileFixture(11, 256);

  it("reads the crest's colours when there is a crest, and the picked ones when there is not", () => {
    expect(paletteOf({ pixels: crestPixels(1), picked: ["#1b2a49"] }).length).toBeGreaterThan(1);
    expect(paletteOf({ pixels: null, picked: ["#1b2a49", "#d4af37"] }).map((one) => one.hex)).toEqual(["#1b2a49", "#d4af37"]);
  });

  it("gives kits, a palette and the vectorise check, with no model asked", async () => {
    const run = await runCrestToKit({
      sportId: "football",
      feel: "modern",
      roles: "all",
      clubName: "Sialkot Rovers",
      crest,
      pixels: crestPixels(11),
      picked: [],
      articles,
    });
    expect(run.status).toBe("kits");
    if (run.status !== "kits") return;
    expect(run.kits.length).toBeGreaterThanOrEqual(CREST_LIMITS.minKits);
    expect(run.kits.length).toBeLessThanOrEqual(CREST_LIMITS.maxKits);
    expect(run.palette.length).toBeGreaterThan(1);
    expect(run.vectorise?.vector).toBe(false);
    for (const { candidate, validation } of run.kits) {
      expect(validation.offerable, candidate.id).toBe(true);
      expect(validation.candidateId).toBe(candidate.id);
    }
  });

  it("works from picked colours with no crest at all", async () => {
    const run = await runCrestToKit({
      sportId: "football",
      feel: "bold",
      roles: "home",
      clubName: null,
      crest: null,
      pixels: null,
      picked: ["#1b2a49", "#d4af37", "#c8102e"],
      articles,
    });
    expect(run.status).toBe("kits");
    expect(run.vectorise).toBeNull();
  });

  it("keeps a ranker's order and says nothing about it when one answered", async () => {
    const first = await runCrestToKit({
      sportId: "football",
      feel: "modern",
      roles: "home",
      clubName: null,
      crest: null,
      pixels: crestPixels(2),
      picked: [],
      articles,
    });
    if (first.status !== "kits") throw new Error("expected kits");
    const asked = [first.kits[2]!.candidate.id, first.kits[0]!.candidate.id];
    const second = await runCrestToKit({
      sportId: "football",
      feel: "modern",
      roles: "home",
      clubName: null,
      crest: null,
      pixels: crestPixels(2),
      picked: [],
      articles,
      ranker: fixedRanking(asked.map((id) => ({ id, line: "A strong one." }))),
    });
    if (second.status !== "kits") throw new Error("expected kits");
    expect(second.kits.slice(0, 2).map((one) => one.candidate.id)).toEqual(asked);
    expect(second.kits[0]!.candidate.note).toBe("A strong one.");
  });

  it("says what it cannot do rather than showing nothing, for a sport with no base article", async () => {
    const run = await runCrestToKit({
      sportId: "winter-code",
      feel: "modern",
      roles: "home",
      clubName: null,
      crest: null,
      pixels: crestPixels(0),
      picked: [],
      articles,
    });
    expect(run.status).toBe("none");
    if (run.status !== "none") return;
    expect(run.reason).toContain("No base article");
    expect(run.palette.length).toBeGreaterThan(0);
  });

  it("adds the vectorise warning to the notes when a crest would print soft", async () => {
    const run = await runCrestToKit({
      sportId: "football",
      feel: "modern",
      roles: "home",
      clubName: null,
      crest: { ...crest, widthPx: 120 },
      pixels: crestPixels(11),
      picked: [],
      articles,
    });
    if (run.status !== "kits") throw new Error("expected kits");
    expect(run.notes.some((note) => note.includes("dots per inch"))).toBe(true);
  });

  it("measures itself against the specification's thirty seconds", () => {
    expect(withinKitBudget(0)).toBe(true);
    expect(withinKitBudget(CREST_LIMITS.budgetMs - 1)).toBe(true);
    expect(withinKitBudget(CREST_LIMITS.budgetMs)).toBe(false);
    expect(withinKitBudget(Number.NaN)).toBe(false);
    expect(withinKitBudget(-1)).toBe(false);
  });

  it("finishes well inside that budget for a crest and all three roles", async () => {
    const started = Date.now();
    await runCrestToKit({ sportId: "football", feel: "modern", roles: "all", clubName: null, crest, pixels: crestPixels(11), picked: [], articles });
    expect(withinKitBudget(Date.now() - started)).toBe(true);
  });
});
