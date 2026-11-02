import { describe, expect, it } from "vitest";
import type { StoredPlayer } from "../roster";
import type { SignupEntry } from "./grid";
import { mergeIntoRoster, mergeSummary } from "./merge";

const player = (id: string, name: string, patch: Partial<StoredPlayer> = {}): StoredPlayer => ({
  id,
  name,
  number: "",
  sizeLabel: "M",
  wearerGroup: "mens",
  ...patch,
});

const entry = (id: string, nameOnShirt: string, patch: Partial<SignupEntry> = {}): SignupEntry => ({
  id,
  nameOnShirt,
  number: "7",
  sizeLabel: "L",
  wearerGroup: "mens",
  updatedAt: "2026-11-01T10:00:00Z",
  ...patch,
});

describe("mergeIntoRoster", () => {
  it("gives the roster back unchanged when nobody has answered", () => {
    const roster = [player("p1", "Alex Morgan")];

    expect(mergeIntoRoster(roster, [])).toMatchObject({ changed: 0, added: 0, skipped: [] });
    expect(mergeIntoRoster(roster, []).players).toEqual([{ name: "Alex Morgan", number: "", sizeLabel: "M", wearerGroup: "mens" }]);
  });

  it("gives a player already on the roster their new number, size and cut, in their own place", () => {
    const merged = mergeIntoRoster([player("p1", "Alex Morgan"), player("p2", "Sam Kerr")], [entry("e1", "SAM KERR", { number: "9", sizeLabel: "S" })]);

    expect(merged.players.map((one) => one.name)).toEqual(["Alex Morgan", "SAM KERR"]);
    expect(merged.players[1]).toMatchObject({ number: "9", sizeLabel: "S" });
    expect(merged).toMatchObject({ changed: 1, added: 0 });
  });

  it("adds a player who is not on the roster at the end", () => {
    const merged = mergeIntoRoster([player("p1", "Alex Morgan")], [entry("e1", "Jordan Nobbs")]);

    expect(merged.players.map((one) => one.name)).toEqual(["Alex Morgan", "Jordan Nobbs"]);
    expect(merged).toMatchObject({ changed: 0, added: 1 });
  });

  it("counts nothing as changed when an answer says what the roster already says", () => {
    const merged = mergeIntoRoster([player("p1", "Alex Morgan", { number: "7", sizeLabel: "L" })], [entry("e1", "Alex Morgan")]);

    expect(merged).toMatchObject({ changed: 0, added: 0 });
  });

  it("never adds a player twice for one answer", () => {
    const merged = mergeIntoRoster([player("p1", "alex   morgan")], [entry("e1", "Alex Morgan")]);

    expect(merged.players).toHaveLength(1);
  });

  it("drops an answer whose cut this club does not use, and says which", () => {
    const merged = mergeIntoRoster([], [entry("e1", "Alex Morgan", { wearerGroup: "veterans" })]);

    expect(merged.players).toEqual([]);
    expect(merged.skipped).toEqual([{ name: "Alex Morgan", reason: "The cut they chose is not one this club uses." }]);
  });
});

describe("mergeSummary", () => {
  it("says plainly what pressing the button will do", () => {
    expect(mergeSummary({ players: [], changed: 2, added: 1, skipped: [] })).toBe("2 players updated, 1 added.");
    expect(mergeSummary({ players: [], changed: 1, added: 0, skipped: [] })).toBe("1 player updated.");
    expect(mergeSummary({ players: [], changed: 0, added: 0, skipped: [] })).toBe("Nothing new to put in the roster.");
  });

  it("counts what it could not use, rather than leaving it unsaid", () => {
    expect(mergeSummary({ players: [], changed: 0, added: 1, skipped: [{ name: "x", reason: "y" }] })).toBe("1 added. 1 could not be used.");
  });
});
