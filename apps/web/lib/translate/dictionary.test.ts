import { describe, expect, it } from "vitest";
import { TRANSLATION_KEYS } from "./keys";
import { dictionaryFor, textOf } from "./dictionary";
import { NOT_AVAILABLE, stubTranslationService, unavailableTranslationService } from "./provider";
import { TRANSLATION_COLUMNS, reviewLine, toTranslationRow, toTranslationRows } from "./rows";
import { DRAFT_STRINGS, ENGLISH, URDU_DRAFT_LABEL } from "./strings";

/** A row of `translation_strings` as the library gives it back. */
const row = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  id: "11111111-1111-4111-8111-111111111111",
  key: "page.overview",
  language: "ur",
  text: "جائزہ",
  source_language: "en",
  translated_by: "knitwright-draft",
  machine: false,
  reviewed_by: null,
  reviewed_role: null,
  reviewed_on: null,
  rule_id: "R-GAP-000",
  label: URDU_DRAFT_LABEL,
  ...over,
});

const rowsOf = (...over: Record<string, unknown>[]) => toTranslationRows(over.map((entry) => row(entry)));

describe("one row of the library", () => {
  it("reads a row and names the columns it needs", () => {
    const parsed = toTranslationRow(row());
    expect(parsed).toMatchObject({ key: "page.overview", language: "ur", text: "جائزہ", machine: false, reviewedBy: null });
    expect(TRANSLATION_COLUMNS).toContain("reviewed_by");
    expect(TRANSLATION_COLUMNS).toContain("machine");
  });

  it("ignores a row for a key or a language this version of the app does not know", () => {
    expect(toTranslationRow(row({ key: "page.not-a-page" }))).toBeNull();
    expect(toTranslationRow(row({ language: "fr" }))).toBeNull();
    expect(rowsOf({ key: "page.not-a-page" }, {})).toHaveLength(1);
  });

  it("reads a review as the name, the role and the day, and nothing less", () => {
    const reviewed = toTranslationRow(row({ reviewed_by: "A Khan", reviewed_role: "Floor supervisor", reviewed_on: "2026-11-02T00:00:00Z" }))!;
    expect(reviewLine(reviewed)).toBe("Reviewed by A Khan, Floor supervisor, on 2026-11-02");
    expect(reviewLine({ reviewedBy: "A Khan", reviewedRole: null, reviewedOn: "2026-11-02" })).toBeNull();
    expect(reviewLine({ reviewedBy: null, reviewedRole: null, reviewedOn: null })).toBeNull();
  });

  it("treats empty text in a name as nobody", () => {
    expect(toTranslationRow(row({ reviewed_by: "  " }))!.reviewedBy).toBeNull();
  });
});

describe("the dictionary of a document", () => {
  it("gives the platform's own words for English, and calls nothing a translation", () => {
    const dictionary = dictionaryFor("en");
    expect(dictionary.direction).toBe("ltr");
    expect(textOf(dictionary, "page.overview")).toBe(ENGLISH["page.overview"]);
    expect(dictionary.reviewed).toBe(true);
    expect(dictionary.unreviewed).toEqual([]);
    expect(dictionary.words("notice.unreviewed").review).toBeNull();
  });

  it("falls back to the draft in the code for every key the library has no row for", () => {
    const dictionary = dictionaryFor("ur");
    expect(dictionary.direction).toBe("rtl");
    expect(dictionary.fromLibrary).toBe(false);
    for (const key of TRANSLATION_KEYS) expect(textOf(dictionary, key), key).toBe(DRAFT_STRINGS.ur[key]);
    expect(dictionary.reviewed).toBe(false);
    expect(dictionary.unreviewed).toEqual([...TRANSLATION_KEYS]);
  });

  it("prefers the library's words over the draft, and says they came from the library", () => {
    const dictionary = dictionaryFor("ur", rowsOf({ text: "نیا جائزہ" }));
    expect(textOf(dictionary, "page.overview")).toBe("نیا جائزہ");
    expect(dictionary.fromLibrary).toBe(true);
    expect(dictionary.words("page.overview").label).toBe(URDU_DRAFT_LABEL);
  });

  it("ignores a row for another language", () => {
    const dictionary = dictionaryFor("ur", toTranslationRows([row({ language: "en", key: "page.qc", text: "QC" })]));
    expect(textOf(dictionary, "page.qc")).toBe(DRAFT_STRINGS.ur["page.qc"]);
  });

  it("counts a word as reviewed only when a person, a role and a day are all named", () => {
    const reviewed = dictionaryFor("ur", rowsOf({ reviewed_by: "A Khan", reviewed_role: "Floor supervisor", reviewed_on: "2026-11-02" }));
    const word = reviewed.words("page.overview");
    expect(word.reviewed).toBe(true);
    expect(word.review).toBe("Reviewed by A Khan, Floor supervisor, on 2026-11-02");
    // Every other key is still a draft, so the document as a whole is not reviewed.
    expect(reviewed.reviewed).toBe(false);
    expect(reviewed.unreviewed).not.toContain("page.overview");
  });

  it("never counts a machine translation as reviewed, whatever the row claims", () => {
    const machine = dictionaryFor("ur", rowsOf({ machine: true, reviewed_by: "A Service", reviewed_role: "Robot", reviewed_on: "2026-11-02" }));
    const word = machine.words("page.overview");
    expect(word.machine).toBe(true);
    expect(word.reviewed).toBe(false);
    expect(machine.unreviewed).toContain("page.overview");
  });

  it("is reviewed as a whole only once every key has a reviewer", () => {
    const rows = TRANSLATION_KEYS.map((key) => row({ key, reviewed_by: "A Khan", reviewed_role: "Floor supervisor", reviewed_on: "2026-11-02" }));
    const dictionary = dictionaryFor("ur", toTranslationRows(rows));
    expect(dictionary.reviewed).toBe(true);
    expect(dictionary.unreviewed).toEqual([]);
  });

  it("gives the same words and the same state every time it is built", () => {
    const rows = rowsOf({});
    expect(TRANSLATION_KEYS.map((key) => textOf(dictionaryFor("ur", rows), key))).toEqual(
      TRANSLATION_KEYS.map((key) => textOf(dictionaryFor("ur", rows), key)),
    );
  });
});

describe("the seam to a translation service", () => {
  it("says there is none rather than returning words", async () => {
    expect(await unavailableTranslationService.translate([])).toEqual({ status: "not-available", reason: NOT_AVAILABLE });
    expect(unavailableTranslationService.name).toBe("none");
  });

  it("marks everything a service proposes as a machine translation with no reviewer", async () => {
    const service = stubTranslationService("test-service");
    const outcome = await service.translate([{ key: "page.qc", text: "QC checklist", from: "en", to: "ur" }]);
    expect(outcome.status).toBe("proposed");
    if (outcome.status !== "proposed") return;
    const [proposal] = outcome.proposals;
    expect(proposal).toMatchObject({ key: "page.qc", language: "ur", machine: true, reviewedBy: null, translatedBy: "test-service" });
    expect(proposal!.label).toContain("Nobody has read it");
  });

  it("has a name, so a row can say which service produced it", () => {
    expect(stubTranslationService().name).toBe("stub");
  });
});
