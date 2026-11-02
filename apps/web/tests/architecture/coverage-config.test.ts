import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The coverage configuration is the file every workstream has to edit, so its shape decides how
 * often two branches conflict. The list of directories held to the higher mark used to be a single
 * line of about a thousand characters: because each workstream appended its own name to that one
 * line, every pair of live branches conflicted on it, and five such conflicts were resolved by hand
 * in a single day on pull requests whose own work was already finished and green. One name per
 * line, in order, means two workstreams touch two lines and git merges them unaided.
 *
 * These tests keep that true. They read the configuration as text on purpose: importing it would
 * only prove the list parses, not that it is still written in the shape that merges cleanly.
 */

const CONFIG = readFileSync(fileURLToPath(new URL("../../vitest.config.mts", import.meta.url)), "utf8");

/*
 * `[\s\S]` rather than the `s` flag: this package's TypeScript target predates it (TS1501).
 */
const LIST = /\.\.\.Object\.fromEntries\(\s*\[([\s\S]*?)\]\.map\(\(dir\) =>/;

/** The body of the `Object.fromEntries` list, as the file writes it. */
const listBody = (): string => {
  const block = LIST.exec(CONFIG);
  expect(block, "the generated per-directory thresholds are no longer written as Object.fromEntries over a list").not.toBeNull();
  return block?.[1] ?? "";
};

/** The directory names inside that list, in the order the file writes them. */
const directoryNames = (): readonly string[] => [...listBody().matchAll(/"([^"]+)"/g)].map((match) => match[1]);

describe("the per-directory coverage thresholds", () => {
  it("names at least every directory the production outputs had", () => {
    // A floor, not an exact count: a workstream adding its own directory must not fail this.
    expect(directoryNames().length).toBeGreaterThanOrEqual(41);
  });

  it("is in alphabetical order, so two workstreams adding names do not conflict", () => {
    const names = directoryNames();
    expect(names).toStrictEqual([...names].sort());
  });

  it("names each directory once", () => {
    const names = directoryNames();
    expect(names).toStrictEqual([...new Set(names)]);
  });

  it("writes one name per line", () => {
    // The whole point: a line holding two names is a line two branches will fight over.
    const lines = listBody().split("\n").filter((line) => line.trim() !== "");
    for (const line of lines) {
      expect([...line.matchAll(/"[^"]+"/g)], `two or more names share this line: ${line.trim()}`).toHaveLength(1);
    }
  });
});
