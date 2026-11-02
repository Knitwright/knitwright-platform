import { describe, expect, it } from "vitest";
import { ALL_IN, NO_REQUESTS_YET } from "./fields";
import { buildGrid, stillWaiting, type SignupEntry, type SignupRequest } from "./grid";

const request = (id: string, name: string, patch: Partial<SignupRequest> = {}): SignupRequest => ({
  id,
  name,
  phone: "",
  email: "",
  ...patch,
});

const entry = (id: string, nameOnShirt: string, patch: Partial<SignupEntry> = {}): SignupEntry => ({
  id,
  nameOnShirt,
  number: "7",
  sizeLabel: "M",
  wearerGroup: "mens",
  updatedAt: "2026-11-01T10:00:00Z",
  ...patch,
});

describe("buildGrid", () => {
  it("has a real empty state naming the one action that fills it", () => {
    const grid = buildGrid([], []);

    expect(grid.rows).toEqual([]);
    expect(grid.summary).toBe(NO_REQUESTS_YET);
  });

  it("marks who is in and who the club is still waiting on", () => {
    const grid = buildGrid([request("r1", "Alex Morgan"), request("r2", "Sam Kerr")], [entry("e1", "ALEX MORGAN")]);

    expect(grid.collected).toBe(1);
    expect(grid.missing).toBe(1);
    expect(grid.rows.map((row) => row.state)).toEqual(["collected", "missing"]);
    expect(grid.rows[0]?.entry?.number).toBe("7");
    expect(grid.rows[0]?.requestId).toBe("r1");
  });

  it("matches a player to the person the club asked however either spelled it", () => {
    const grid = buildGrid([request("r1", "alex   morgan")], [entry("e1", "Alex Morgan")]);

    expect(grid.collected).toBe(1);
    expect(grid.extra).toBe(0);
  });

  it("says so when the whole list has answered", () => {
    expect(buildGrid([request("r1", "Alex Morgan")], [entry("e1", "Alex Morgan")]).summary).toBe(ALL_IN);
  });

  it("shows an answer from someone not on the list, named as such, rather than dropping it", () => {
    const grid = buildGrid([request("r1", "Alex Morgan")], [entry("e1", "Alex Morgan"), entry("e2", "Nobody Expected")]);

    expect(grid.extra).toBe(1);
    expect(grid.rows[1]).toMatchObject({ state: "extra", name: "Nobody Expected", requestId: null });
    expect(grid.summary).toContain("1 answer came from someone not on your list");
  });

  it("counts several unexpected answers in plain words", () => {
    const grid = buildGrid([], [entry("e1", "One"), entry("e2", "Two")]);

    expect(grid.summary).toContain("2 answers came from someone not on your list");
  });

  it("flags a number two players used, and keeps both: only the club knows which is right", () => {
    const grid = buildGrid(
      [request("r1", "Alex Morgan"), request("r2", "Sam Kerr")],
      [entry("e1", "Alex Morgan", { number: "7" }), entry("e2", "Sam Kerr", { number: "7" })],
    );

    expect(grid.collected).toBe(2);
    for (const row of grid.rows) {
      expect(row.flags.map((flag) => flag.kind)).toContain("duplicate_number");
      expect(row.flags[0]?.ruleId).toBe("R-GAP-000");
      expect(row.flags[0]?.message).toBe("Number 7 is used more than once.");
    }
  });

  it("tells 07 and 7 apart, because a shirt does", () => {
    const grid = buildGrid(
      [request("r1", "Alex Morgan"), request("r2", "Sam Kerr")],
      [entry("e1", "Alex Morgan", { number: "07" }), entry("e2", "Sam Kerr", { number: "7" })],
    );

    expect(grid.rows.flatMap((row) => row.flags)).toEqual([]);
  });

  it("flags a shirt name two players sent, which is almost always a slip", () => {
    const grid = buildGrid([request("r1", "Morgan")], [entry("e1", "MORGAN", { number: "7" }), entry("e2", "morgan", { number: "8" })]);
    const flags = grid.rows.flatMap((row) => row.flags.map((flag) => flag.kind));

    expect(flags).toContain("duplicate_name");
  });

  it("carries the ways a club has of reaching whoever is missing", () => {
    const grid = buildGrid([request("r1", "Alex Morgan", { phone: "07700900000", email: "a@example.com" })], []);

    expect(grid.rows[0]).toMatchObject({ phone: "07700900000", email: "a@example.com" });
  });
});

describe("stillWaiting", () => {
  it("is who a chase goes to, and nobody else", () => {
    const grid = buildGrid([request("r1", "Alex Morgan"), request("r2", "Sam Kerr")], [entry("e1", "Alex Morgan")]);

    expect(stillWaiting(grid).map((row) => row.name)).toEqual(["Sam Kerr"]);
  });
});
