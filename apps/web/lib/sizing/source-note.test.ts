import { describe, expect, it } from "vitest";
import { parseSourceNote } from "./source-note";

describe("parseSourceNote", () => {
  it("reads a name and a date in either order and with common link words", () => {
    const expected = { ok: true, source: { person: "Test Person", date: "2000-01-01" } };
    for (const note of [
      "Test Person, 2000-01-01",
      "2000-01-01 Test Person",
      "Test Person on 2000-01-01",
      "Test Person (2000-01-01)",
      "by Test Person, dated 2000-01-01",
      "2000-01-01, by Test Person",
    ]) {
      expect(parseSourceNote(note)).toEqual(expected);
    }
  });

  it("refuses an empty note with a sentence that shows what to write", () => {
    const result = parseSourceNote("  ");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("Every chart needs a source");
  });

  it("refuses a note with no date, or a date that is not a real day", () => {
    expect(parseSourceNote("Test Person").ok).toBe(false);
    const bad = parseSourceNote("Test Person, 2000-13-45");
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.message).toContain("not a real day");
  });

  it("refuses a note with a date but no person, or only a placeholder", () => {
    for (const note of ["2000-01-01", " , 2000-01-01", "TBC 2000-01-01", "12345 2000-01-01"]) {
      expect(parseSourceNote(note).ok).toBe(false);
    }
  });
});
