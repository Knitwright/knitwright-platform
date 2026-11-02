import { describe, expect, it } from "vitest";
import { articleBook, jersey } from "@/lib/teamwear/fixtures/kit";
import { clubColoursFor } from "./arrange";
import { readCrest } from "./crest";
import { candidateKits, finishVariantsFor, idOf, missingFamiliesNote, noteFor, type KitCandidate } from "./engine";
import { familiesOf, familiesMissingNote, familyById, MISSING_FAMILIES, TEMPLATE_FAMILIES } from "./families";
import { crestFileFixture, crestPixels } from "./fixtures/crests";
import { readIntake } from "./intake";
import { crestColours, pickedColours } from "./palette";
import { applyRanking, rankByFit } from "./rank";
import { firstStopper, setAsideNote, validateCandidate, validatedKits } from "./validate";

/**
 * The edges of each rule: the cases a club meets rarely and which a screen must still answer in
 * words. Each one is here because it is a branch the ordinary path does not take.
 */

const articles = articleBook();
const palette = () => crestColours(crestPixels(0));

const candidate = (): KitCandidate => {
  const outcome = candidateKits({ sportId: "football", feel: "modern", roles: "home", palette: palette(), articles, crest: null });
  if (outcome.status !== "kits") throw new Error("expected kits");
  return outcome.candidates[0]!;
};

describe("the family tables at their edges", () => {
  it("leaves out a family name no table carries, rather than failing", () => {
    expect(familyById("not-a-family")).toBeUndefined();
    expect(familiesOf(["plain", "not-a-family", "striped"]).map((one) => one.id)).toEqual(["plain", "striped"]);
    expect(familiesOf([])).toEqual([]);
  });

  it("says nothing when every family is offered, and names them when they are not", () => {
    expect(familiesMissingNote([])).toBe("");
    expect(familiesMissingNote([MISSING_FAMILIES[0]!])).toContain("is not offered yet");
    expect(familiesMissingNote(MISSING_FAMILIES)).toContain("are not offered yet");
    expect(missingFamiliesNote([])).toEqual([]);
    expect(missingFamiliesNote([MISSING_FAMILIES[0]!])[0]).toContain("for this yet");
    expect(missingFamiliesNote(MISSING_FAMILIES)[0]).toContain("for these yet");
  });
});

describe("an article with nothing but a fill group", () => {
  const onlyFills = { ...jersey(), options: jersey().options.filter((option) => option.group === "pattern_fill") };

  it("still gives one finish combination, which holds nothing", () => {
    expect(finishVariantsFor("classic", onlyFills)).toEqual([{}]);
  });

  it("writes a kit's line without a finish, and still names the fill and the article", () => {
    const family = TEMPLATE_FAMILIES.find((one) => one.code === "P00")! as typeof TEMPLATE_FAMILIES[number] & { code: string };
    const arrangement = { role: "home" as const, roleLabel: "Home", colours: { main: "#111111", second: "#ffffff", third: null }, socksColour: "#111111", note: "Read from your crest." };
    expect(noteFor(arrangement, family, {}, "JSY-SS-01")).toBe("Home kit: Plain · P00 on JSY-SS-01. Read from your crest.");
    expect(idOf({ role: "home", family, codes: {} })).toBe("home_P00");
  });

  it("builds kits from it, one per family and role", () => {
    const book = new Map(articles);
    book.set("JSY-SS-01", onlyFills);
    const outcome = candidateKits({ sportId: "football", feel: "classic", roles: "all", palette: palette(), articles: book, crest: null });
    expect(outcome.status).toBe("kits");
    if (outcome.status !== "kits") return;
    // Two families and two roles, with one finish each: four kits, fewer than the six it aims for.
    expect(outcome.candidates).toHaveLength(4);
    expect(outcome.notes.some((note) => note.includes("fewer than the six"))).toBe(true);
  });
});

describe("colours at their edges", () => {
  it("gives a three-colour feel no third colour when the crest has only two", () => {
    expect(clubColoursFor(pickedColours(["#1b2a49", "#d4af37"]), "modern")!.third).toBeNull();
  });
});

describe("a crest whose size nobody measured", () => {
  it("is read, kept and left for the vectorise check to say so", () => {
    const read = readCrest("crest.png", crestFileFixture(0, 64).bytes);
    expect(read.ok && [read.crest.widthPx, read.crest.heightPx]).toEqual([null, null]);
  });
});

describe("a form that sends one colour rather than several", () => {
  it("is read as a list of one", () => {
    expect(readIntake({ sportId: "football", roles: "home", feel: "plain", colour: "#1b2a49" }, false)).toMatchObject({
      ok: true,
      input: { colours: ["#1b2a49"] },
    });
  });
});

describe("a kit with no crest to measure against", () => {
  it("is put last in Knitwright's own order rather than first", () => {
    const one = candidate();
    const unknown: KitCandidate = { ...one, id: "no-drift", primaryDeltaE00: null };
    const near: KitCandidate = { ...one, id: "near", primaryDeltaE00: 0.2 };
    expect(rankByFit([unknown, near]).map((item) => item.id)).toEqual(["near", "no-drift"]);
  });

  it("keeps its own line when a ranker names no kit at all", () => {
    const own = [candidate()];
    expect(applyRanking(own, []).map((one) => one.note)).toEqual([own[0]!.note]);
  });
});

describe("a candidate whose base article could not be read", () => {
  it("is set aside, because the catalogue cannot hold it to a range", () => {
    const validation = validateCandidate(candidate(), new Map());
    expect(validation.offerable).toBe(false);
    expect(validation.findings.some((one) => one.code === "article-not-offered")).toBe(true);
  });
});

describe("the note about kits that were set aside", () => {
  it("says nothing when none was, and counts them when some were", () => {
    expect(setAsideNote([])).toBeNull();
    expect(firstStopper(undefined)).toBe("");
    const checked = validatedKits([candidate()], new Map());
    expect(checked.setAsideNote ?? "").toContain("1 kit was set aside");
    expect(setAsideNote([...checked.setAside, ...checked.setAside]) ?? "").toContain("2 kits were set aside");
  });
});
