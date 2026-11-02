import { describe, expect, it } from "vitest";
import { finishedRecord, record } from "../fixtures/brand";
import { decide, decideKind, tickRights } from "./decisions";
import { itemId } from "./items";
import { completionView, emptyView, errorView, groupsOf, importView, progressOf, stageLines } from "./view";
import { proposal } from "./fixtures/proposal";
import { refuse } from "./fetch";
import { IMPORT_STAGES, REFUSAL_REASONS } from "./words";
import type { StageReport } from "./types";

/**
 * The screen's own model. Each test here stands for one line of the bar the owner set: honest
 * progress, a real empty state, an error that says why and what to do, a decision per item, a tick
 * that starts false, and a completion % that explains what is missing.
 */

const logoId = itemId("logo", "https://ravensmoor.test/media/logo.png");

const stage = (over: Partial<StageReport>): StageReport => ({ stage: "logos", status: "pending", found: null, because: null, tookMs: null, ...over });

describe("stageLines", () => {
  it("gives every stage a label, a line of words and a state said in words, not a colour", () => {
    const lines = stageLines(proposal().stages);
    expect(lines).toHaveLength(IMPORT_STAGES.length);
    expect(lines.every((line) => line.label !== "" && line.words !== "" && line.said !== "")).toBe(true);
  });

  it("says what a stage is doing while it runs, and what it found when it is done", () => {
    expect(stageLines([stage({ status: "running" })])[0]?.words).toContain("Reading the favicon");
    expect(stageLines([stage({ status: "done", found: 3 })])[0]?.words).toBe("3 found.");
  });

  it("says what is missing when a stage found nothing, and why when it was left out", () => {
    expect(stageLines([stage({ status: "empty", found: 0 })])[0]?.words).toContain("Add one from your uploads");
    expect(stageLines([stage({ status: "skipped", because: "The minute was up." })])[0]?.words).toBe("The minute was up.");
  });

  it("tells a stage that has not started from one that is working", () => {
    expect(stageLines([stage({ status: "pending" })])[0]?.said).toBe("Waiting");
    expect(stageLines([stage({ status: "running" })])[0]?.said).toBe("Working");
  });
});

describe("progressOf", () => {
  it("says which stage of six is running, so the minute never looks frozen", () => {
    const reports = IMPORT_STAGES.map((name, at) => stage({ stage: name, status: at < 2 ? "done" : at === 2 ? "running" : "pending", found: at < 2 ? 1 : null }));
    const progress = progressOf(reports);
    expect(progress).toMatchObject({ running: true, summary: "Stage 3 of 6 · Reading your colours" });
    expect(progress.percent).toBe(33);
  });

  it("says the run is over when every stage has settled", () => {
    expect(progressOf(proposal().stages)).toMatchObject({ running: false, percent: 100, summary: "All 6 stages finished." });
  });

  it("says how far it got when a run ended early", () => {
    const reports = IMPORT_STAGES.map((name, at) => stage({ stage: name, status: at === 0 ? "failed" : "pending" }));
    expect(progressOf(reports).summary).toBe("1 of 6 stages finished.");
  });
});

describe("groupsOf", () => {
  it("gives one group per kind, in the brand page's order, each with its own heading and count", () => {
    const groups = groupsOf(proposal());
    expect(groups.map((group) => group.kind)).toEqual(["logo", "colour", "font", "graphic", "style"]);
    expect(groups[1]?.heading).toBe("Colour (2)");
  });

  it("gives a real empty state naming the one action that fills it", () => {
    const empty = groupsOf(proposal({ logos: [], graphics: [], colours: [], fonts: [], style: null }));
    expect(empty.every((group) => group.empty !== null)).toBe(true);
    expect(empty[0]?.empty).toContain("Add one from your uploads instead");
    expect(empty[3]?.empty).toContain("Upload your own photos instead");
  });

  it("offers a shortcut only where there is more than one row still waiting", () => {
    const groups = groupsOf(proposal());
    expect(groups.find((group) => group.kind === "logo")?.keepAll).toBeNull();
    expect(groups.find((group) => group.kind === "colour")?.keepAll).toBe("Keep all 2");
  });

  it("counts what has been kept per group", () => {
    const groups = groupsOf(decideKind(proposal(), "colour", "accepted"));
    expect(groups.find((group) => group.kind === "colour")?.keptCount).toBe(2);
    expect(groups.find((group) => group.kind === "logo")?.keptCount).toBe(0);
  });
});

describe("importView", () => {
  it("offers the two buttons of a decision on every row, rather than one import button", () => {
    const view = importView(proposal());
    expect(view.decisionLabels).toEqual({ accepted: "Keep", rejected: "Leave out" });
    expect(view.groups.flatMap((group) => group.rows).length).toBeGreaterThan(8);
  });

  it("shows the tick unticked, and says it is needed once a picture is kept", () => {
    expect(importView(proposal()).rights).toMatchObject({ ticked: false, needed: false });
    const kept = importView(decide(proposal(), logoId, "accepted"));
    expect(kept.rights).toMatchObject({ ticked: false, needed: true });
    expect(kept.rights.because).toBe(proposal().rights.ask);
  });

  it("stops saying anything stands in the way once the tick is given", () => {
    const view = importView(tickRights(decide(proposal(), logoId, "accepted"), true));
    expect(view.rights).toMatchObject({ ticked: true, because: null });
  });

  it("promises that nothing of the site is kept, wherever a picture is offered", () => {
    expect(importView(proposal()).promise).toContain("keeps nothing from your site");
  });

  it("counts what is kept and what is still waiting", () => {
    const view = importView(decide(proposal(), logoId, "accepted"));
    expect(view.keptCount).toBe(1);
    expect(view.pendingCount).toBe(view.groups.flatMap((group) => group.rows).length - 1);
  });
});

describe("completionView", () => {
  it("explains what is missing rather than only showing a number", () => {
    const view = completionView(record());
    expect(view.percent).toBe(0);
    expect(view.missing.length).toBeGreaterThan(4);
    expect(view.missing[0]).toContain("Details:");
  });

  it("says whose weighting the number is", () => {
    expect(completionView(record()).source).toContain("not reviewed by anyone");
  });

  it("has nothing left to say when a brand has filled everything in", () => {
    expect(completionView(finishedRecord())).toMatchObject({ percent: 100, missing: [] });
  });
});

describe("emptyView", () => {
  it("names the one action that fills the panel", () => {
    expect(emptyView().action).toBe("Paste your address");
    expect(emptyView().body).toContain("your own website or Instagram page");
  });
});

describe("errorView", () => {
  it.each([...REFUSAL_REASONS])("says why a site could not be read, for %s", (reason) => {
    const view = errorView(refuse(reason));
    expect(view.body.length).toBeGreaterThan(30);
    expect(view.heading).toBe("Your site could not be read");
  });

  it("offers Try again only where trying again may answer differently", () => {
    expect(errorView(refuse("too_slow")).retry).toBe("Try again");
    expect(errorView(refuse("unreachable")).retry).toBe("Try again");
    expect(errorView(refuse("robots")).retry).toBeNull();
    expect(errorView(refuse("not_https")).retry).toBeNull();
  });

  it("names the reason in the words a person can act on", () => {
    expect(errorView(refuse("robots")).body).toContain("robots.txt");
    expect(errorView(refuse("not_https")).body).toContain("https://");
    expect(errorView(refuse("too_slow")).body).toContain("did not answer in time");
  });
});
