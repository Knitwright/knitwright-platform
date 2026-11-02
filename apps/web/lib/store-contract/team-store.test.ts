import { describe, expect, it } from "vitest";
import { storeTeamStore, TEAM_STORE_HANDOVER } from "./team-store";
import { emptyTeamStore, fullTeamStore, ids } from "./fixtures/samples";

/**
 * A team store's configuration. It is a configuration: no link, no shop front, no takings. Where the
 * club has settled nothing, the field is a gap, because a Store handed a null colour renders black.
 */

describe("a team store configured from a club design", () => {
  it("names the design the kit was settled on", () => {
    const store = storeTeamStore(fullTeamStore());
    if (store.design.status !== "held") throw new Error("held");

    expect(store.design.projectId).toBe(ids.project);
    expect(store.design.version).toBe(7);
  });

  it("carries the club's colours, crest, sponsors and fonts", () => {
    const store = storeTeamStore(fullTeamStore());
    const primary = store.colours.find((colour) => colour.slot === "primary")?.colour;
    if (primary?.status !== "held") throw new Error("held");

    expect(primary.hex).toBe("#0b3d91");
    expect(store.crest.status).toBe("held");
    expect(store.sponsors).toEqual([{ name: "Test Sponsor", logoFileId: null }]);
    expect(store.nameFont).toBe("geist");
  });

  it("carries the seasons with their dates, and the sport's number range", () => {
    const store = storeTeamStore(fullTeamStore());
    const season = store.seasons[0];
    if (season?.startsOn.status !== "held") throw new Error("held");
    if (store.numbers.status !== "held") throw new Error("held");

    expect(season.startsOn.date).toBe("2027-08-01");
    expect(store.numbers.highest).toBe(99);
    expect(store.numbers.note).toContain("not read against any league rule book");
  });

  it("says plainly that it is a configuration and not a shop", () => {
    expect(storeTeamStore(fullTeamStore()).handover).toBe(TEAM_STORE_HANDOVER);
    expect(TEAM_STORE_HANDOVER).toContain("no way to take money");
  });
});

describe("a club that has settled nothing", () => {
  it("has a gap for every colour, and says to ask the club rather than choose one", () => {
    const store = storeTeamStore(emptyTeamStore());
    const primary = store.colours.find((colour) => colour.slot === "primary")?.colour;
    if (primary?.status !== "gap") throw new Error("gap");

    expect(store.colours.every((colour) => colour.colour.status === "gap")).toBe(true);
    expect(primary.because).toContain("must ask the club rather than choose one");
  });

  it("has a gap for the design, the crest, the season's dates, the numbers and the sizes", () => {
    const store = storeTeamStore(emptyTeamStore());

    expect(store.design.status).toBe("gap");
    expect(store.crest.status).toBe("gap");
    expect(store.seasons[0]?.startsOn.status).toBe("gap");
    expect(store.seasons[0]?.endsOn.status).toBe("gap");
    expect(store.numbers.status).toBe("gap");
    expect(store.sizes.status).toBe("gap");
  });

  it("tells the Store to take no number until a rule for the sport is on file", () => {
    const store = storeTeamStore(emptyTeamStore());
    if (store.numbers.status !== "gap") throw new Error("gap");

    expect(store.numbers.because).toContain("take no number");
  });

  it("carries no null anywhere, which is the point of the shape", () => {
    const text = JSON.stringify(storeTeamStore(emptyTeamStore()));

    expect(text).not.toContain("null");
  });
});
