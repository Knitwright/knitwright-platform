import { describe, expect, it } from "vitest";
import { REQUESTS_MAX } from "./fields";
import { matchKey, readPastedList } from "./paste";

describe("matchKey", () => {
  it("folds a name the way the database folds it, so a browser and the database agree", () => {
    expect(matchKey("  Alex   Morgan ")).toBe("alex morgan");
    expect(matchKey("ALEX MORGAN")).toBe(matchKey("alex morgan"));
    expect(matchKey("x".repeat(60))).toHaveLength(40);
  });
});

describe("readPastedList", () => {
  it("takes one person per line and skips the blank ones", () => {
    const read = readPastedList("Alex Morgan\n\n  \nSam Kerr\n");

    expect(read.people.map((person) => person.name)).toEqual(["Alex Morgan", "Sam Kerr"]);
    expect(read.problems).toEqual([]);
  });

  it("takes a phone number or an email address after a comma, a tab or a semicolon", () => {
    const read = readPastedList("Alex Morgan, +44 1632 960000\nSam Kerr\tsam@example.com\nJordan Nobbs; 07700900000; j@example.com");

    expect(read.people[0]).toEqual({ name: "Alex Morgan", phone: "+441632960000", email: "" });
    expect(read.people[1]).toEqual({ name: "Sam Kerr", phone: "", email: "sam@example.com" });
    expect(read.people[2]).toEqual({ name: "Jordan Nobbs", phone: "07700900000", email: "j@example.com" });
  });

  it("keeps a name listed twice once, and names it, rather than quietly shortening the list", () => {
    const read = readPastedList("Alex Morgan\nALEX  MORGAN\nSam Kerr");

    expect(read.people).toHaveLength(2);
    expect(read.duplicates).toEqual(["ALEX MORGAN"]);
  });

  it("says which line it could not read, and reads the rest", () => {
    const read = readPastedList("Alex Morgan\n@@@\nSam Kerr");

    expect(read.people.map((person) => person.name)).toEqual(["Alex Morgan", "Sam Kerr"]);
    expect(read.problems).toEqual([{ line: 2, message: expect.stringContaining("Use letters") }]);
  });

  it("says plainly when a line holds no name at all", () => {
    expect(readPastedList(", 07700900000").problems[0]?.message).toBe("This line has no name on it.");
  });

  it("stops at the most people a season may be waiting on, and says it stopped", () => {
    const read = readPastedList(Array.from({ length: REQUESTS_MAX + 5 }, (_, at) => `Player ${at}`).join("\n"));

    expect(read.people).toHaveLength(REQUESTS_MAX);
    expect(read.problems[0]?.message).toContain(`${REQUESTS_MAX} people`);
  });

  it("reads a list pasted out of Windows, with its line endings", () => {
    expect(readPastedList("Alex Morgan\r\nSam Kerr\r\n").people).toHaveLength(2);
  });
});
