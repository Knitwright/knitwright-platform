import { describe, expect, it } from "vitest";
import { designWith } from "@/lib/flat/fixtures/designs";
import { applyAction } from "@/lib/garment";
import { accepted, start } from "@/lib/garment/fixtures/specs";
import { CHARTS } from "./fixtures/charts";
import { buildCover } from "./cover";
import { REVISIONS_SHOWN, type TechPackInput } from "./input";
import { revisions } from "./fixtures/revisions";

const base = (overrides: Partial<TechPackInput> = {}): TechPackInput => ({
  project: { name: "Club shirt", styleNumber: "CP-7", season: "SS27", brandName: "Test Brand" },
  version: 4,
  versionDate: "29 Sep 2026",
  versionDateIso: "2026-09-29",
  printedOn: "30 Sep 2026",
  printedOnIso: "2026-09-30",
  history: [],
  spec: start("polo", "men"),
  flats: { front: null, back: null },
  ...overrides,
});

describe("the cover", () => {
  it("shows the style number, season, brand and design name, each with its source", () => {
    const cover = buildCover(base());
    expect(cover.id).toBe("cover");
    expect(cover.title).toBe("Cover");
    expect(cover.styleNumber).toEqual({ status: "set", value: "CP-7", provenance: "user-edited" });
    expect(cover.season).toEqual({ status: "set", value: "SS27", provenance: "user-edited" });
    expect(cover.brand).toEqual({ status: "set", value: "Test Brand", provenance: "brand-supplied" });
    expect(cover.designName).toEqual({ status: "set", value: "Club shirt", provenance: "user-edited" });
  });

  it("shows a style number or season nobody entered as to be confirmed", () => {
    const cover = buildCover(base({ project: { name: "Club shirt", styleNumber: "", season: "  ", brandName: "Test Brand" } }));
    expect(cover.styleNumber).toEqual({ status: "to-be-confirmed" });
    expect(cover.season).toEqual({ status: "to-be-confirmed" });
    expect(cover.note).toBe("Some details are still to be confirmed.");
  });

  it("names the garment type and the wearer by their labels", () => {
    const cover = buildCover(base());
    expect(cover.garmentType).toEqual({ status: "set", value: "Polo shirt", provenance: "user-edited" });
    expect(cover.wearer).toEqual({ status: "set", value: "Men", provenance: "user-edited" });
  });

  it("gives the version number, its date and no other date", () => {
    const cover = buildCover(base());
    expect(cover.version).toBe(4);
    expect(cover.date).toBe("29 Sep 2026");
  });

  it("carries the date in the form a spreadsheet reads, beside the words", () => {
    const cover = buildCover(base({ history: revisions(2) }));
    expect(cover.dateIso).toBe("2026-09-29");
    expect(cover.revisions[0]).toMatchObject({ date: "2 Sep 2026", dateIso: "2026-09-02" });
  });

  it("shows the base size and the size run of the design as typed by the user", () => {
    const spec = accepted(
      applyAction(start("polo"), { type: "set-sizing", sizing: { sizes: ["S", "M", "L"], baseSize: "M" } }),
    ).spec;
    const cover = buildCover(base({ spec }));
    expect(cover.baseSize).toEqual({ status: "set", value: "M", provenance: "user-edited" });
    expect(cover.sizeRun).toEqual({ status: "set", value: "S, M, L", provenance: "user-edited" });
  });

  it("shows sizes that come from a size chart as suggested from the chart", () => {
    const spec = designWith("polo", {});
    const cover = buildCover(base({ spec, charts: CHARTS }));
    expect(cover.baseSize).toEqual({ status: "set", value: "U3", provenance: "suggested-chart" });
    expect(cover.sizeRun).toEqual({ status: "set", value: "U1, U2, U3, U4", provenance: "suggested-chart" });
  });

  it("shows the sizes as to be confirmed when there are none", () => {
    const cover = buildCover(base());
    expect(cover.baseSize).toEqual({ status: "to-be-confirmed" });
    expect(cover.sizeRun).toEqual({ status: "to-be-confirmed" });
  });

  it("lists each option with the choice made and who made it, and marks a choice nobody made as the standard one", () => {
    const cover = buildCover(base());
    const collar = cover.options.find((option) => option.id === "collar");
    expect(collar).toEqual({
      id: "collar",
      label: "Collar",
      choice: { status: "set", value: "Polo collar", provenance: "derived", standard: true },
    });
    const chosen = applyAction(start("polo"), { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "user-edited" });
    const fit = buildCover(base({ spec: accepted(chosen).spec })).options.find((option) => option.id === "fit");
    expect(fit?.choice).toEqual({ status: "set", value: "Slim", provenance: "user-edited" });
    expect(cover.options.map((option) => option.id)).toEqual(["fit", "neckline", "collar", "placket", "sleeve-type", "sleeve-length", "hem-shape", "side-panels", "cuffs"]);
  });

  it("shows a suggested option with the source of the suggestion", () => {
    const spec = accepted(
      applyAction(start("polo"), { type: "set-option", optionId: "fit", choiceId: "slim", provenance: "ai-suggested" }),
    ).spec;
    const fit = buildCover(base({ spec })).options.find((option) => option.id === "fit");
    expect(fit?.choice).toEqual({ status: "set", value: "Slim", provenance: "ai-suggested" });
  });
});

describe("the revision history", () => {
  it("lists at most eight revisions", () => {
    expect(REVISIONS_SHOWN).toBe(8);
  });

  it("lists the newest first, with the date, the note and who made the change", () => {
    const cover = buildCover(base({ history: revisions(3) }));
    expect(cover.revisions.map((entry) => entry.version)).toEqual([3, 2, 1]);
    expect(cover.revisions[0]).toEqual({ version: 3, date: "3 Sep 2026", dateIso: "2026-09-03", note: "Change 3.", by: "Sam Test" });
    expect(cover.olderRevisionsNote).toBeNull();
  });

  it("says who is not recorded, in words", () => {
    const cover = buildCover(base({ history: revisions(2) }));
    expect(cover.revisions[0]?.by).toBe("Not recorded");
  });

  it("sorts a history given in any order", () => {
    const all = revisions(4);
    const shuffled = [all[1], all[3], all[0], all[2]].flatMap((entry) => (entry ? [entry] : []));
    const cover = buildCover(base({ history: shuffled }));
    expect(cover.revisions.map((entry) => entry.version)).toEqual([4, 3, 2, 1]);
  });

  it("limits the list to the named number and says older ones are not shown", () => {
    const cover = buildCover(base({ history: revisions(REVISIONS_SHOWN + 5) }));
    expect(cover.revisions).toHaveLength(REVISIONS_SHOWN);
    expect(cover.revisions[0]?.version).toBe(REVISIONS_SHOWN + 5);
    expect(cover.olderRevisionsNote).toBe("Older revisions are not shown.");
  });

  it("shows every revision when there are exactly the limit", () => {
    const cover = buildCover(base({ history: revisions(REVISIONS_SHOWN) }));
    expect(cover.revisions).toHaveLength(REVISIONS_SHOWN);
    expect(cover.olderRevisionsNote).toBeNull();
  });

  it("shows every revision when there is one fewer than the limit", () => {
    const cover = buildCover(base({ history: revisions(REVISIONS_SHOWN - 1) }));
    expect(cover.revisions).toHaveLength(REVISIONS_SHOWN - 1);
    expect(cover.olderRevisionsNote).toBeNull();
  });

  it("shows the newest revisions when there is one more than the limit, and leaves out the oldest", () => {
    const cover = buildCover(base({ history: revisions(REVISIONS_SHOWN + 1) }));
    expect(cover.revisions.map((entry) => entry.version)).toEqual(
      Array.from({ length: REVISIONS_SHOWN }, (_, index) => REVISIONS_SHOWN + 1 - index),
    );
    expect(cover.olderRevisionsNote).toBe("Older revisions are not shown.");
  });

  it("does not change the history it is given", () => {
    const history = revisions(3);
    const copy = JSON.stringify(history);
    buildCover(base({ history }));
    expect(JSON.stringify(history)).toBe(copy);
  });
});
