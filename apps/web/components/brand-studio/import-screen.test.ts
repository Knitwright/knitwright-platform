import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { decide, decideKind, tickRights } from "@/lib/brand-studio/import/decisions";
import { proposal } from "@/lib/brand-studio/import/fixtures/proposal";
import { completionView, errorView, groupsOf, importView, stageLines, progressOf } from "@/lib/brand-studio/import/view";
import { refuse } from "@/lib/brand-studio/import/fetch";
import { DECISION_LABELS, EMPTY_IMPORT, IMPORT_STAGES } from "@/lib/brand-studio/import/words";
import { PICTURES_NOT_SAVED_YET, RUN, RUN_TAKES_A_MINUTE, URL_LABEL, saved } from "@/lib/brand-studio/import-screen/words";
import { finishedRecord, record } from "@/lib/brand-studio/fixtures/brand";
import { ImportGroup } from "./ImportGroups";
import { ImportPanel, changesOf } from "./ImportPanel";
import { ImportStages } from "./ImportStages";

/**
 * THE BRAND IMPORT SCREEN, rendered without a browser (the renderer's contract is decision 0102
 * item 10; built by decision 0108).
 *
 * L7's engine and view model were finished and tested; what had never existed was a component, so
 * what is checked here is the renderer's own promises: all six stages said in words from the start,
 * per-item Keep and Leave out, the real empty state of a group that found nothing, an error that
 * says why and what to do, a rights box that is labelled and starts unticked, and the completion %
 * with what is still missing.
 */

const render = (element: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&").replaceAll("&#x2F;", "/");

const completion = () => completionView(finishedRecord());

describe("the screen before anything has been pasted", () => {
  it("says what the import is for, and names the one action that starts it", () => {
    const html = render(createElement(ImportPanel, { completion: completion(), canEdit: true }));
    expect(html).toContain(EMPTY_IMPORT.heading);
    expect(html).toContain(EMPTY_IMPORT.body);
    expect(html).toContain(URL_LABEL);
    expect(html).toContain(RUN);
    expect(html).toContain(RUN_TAKES_A_MINUTE);
  });

  it("labels the address field, and leaves the button off until an address is typed", () => {
    const html = render(createElement(ImportPanel, { completion: completion(), canEdit: true }));
    expect(html).toContain("import-url");
    expect(html).toMatch(/<label[^>]*for="[^"]+"/);
    expect(html).toContain("disabled");
  });

  it("will not offer the import at all to somebody whose role may not change the brand", () => {
    const html = render(createElement(ImportPanel, { completion: completion(), canEdit: false }));
    expect(html).toContain("disabled");
  });

  it("shows the completion % with what is still missing, and whose weighting it is", () => {
    const empty = completionView(record());
    const html = render(createElement(ImportPanel, { completion: empty, canEdit: true }));
    expect(html).toContain(`${empty.percent}% complete`);
    expect(html).toContain("not reviewed by anyone");
    expect(empty.missing.length).toBeGreaterThan(0);
    for (const line of empty.missing) expect(html).toContain(line);
  });
});

describe("the six stages", () => {
  it("are all drawn from the start, each with a label, a line of words and its state in words", () => {
    const stages = stageLines(IMPORT_STAGES.map((stage) => ({ stage, status: "pending" as const, found: null, because: null, tookMs: null })));
    const html = render(createElement(ImportStages, { stages, progress: progressOf(stages.map((line) => ({ stage: line.stage, status: line.status, found: null, because: null, tookMs: null }))) }));
    expect(stages).toHaveLength(6);
    for (const stage of stages) {
      expect(html).toContain(stage.label);
      expect(html).toContain(stage.words);
      expect(html).toContain(stage.said);
    }
    expect(html).toContain('aria-live="polite"');
  });

  it("says which stage of six is running, in the view model's own words", () => {
    const view = importView(proposal());
    const html = render(createElement(ImportStages, { stages: view.stages, progress: view.progress }));
    expect(html).toContain(view.progress.summary);
  });

  /** A stage that found nothing says what is missing and what to do instead, never a blank. */
  it("says what a stage that found nothing means", () => {
    const stages = stageLines([{ stage: "logos", status: "empty", found: 0, because: null, tookMs: 3 }]);
    expect(stages[0]?.words).toContain("Add one from your uploads instead");
    expect(stages[0]?.said).toBe("Nothing found");
  });
});

describe("one group of what an import found", () => {
  const groups = () => groupsOf(proposal());

  it("gives every row its own Keep and Leave out, and says which was chosen", () => {
    const group = groups().find((one) => one.kind === "colour")!;
    const html = render(createElement(ImportGroup, { group, labels: DECISION_LABELS, busy: false, onDecide: () => undefined, onKeepAll: () => undefined }));
    expect(group.rows.length).toBeGreaterThan(1);
    for (const row of group.rows) {
      expect(html).toContain(`import-keep-${row.id}`);
      expect(html).toContain(`import-leave-${row.id}`);
    }
    expect(html).toContain(DECISION_LABELS.accepted);
    expect(html).toContain(DECISION_LABELS.rejected);
    expect(html).toContain("Not decided yet");
  });

  it("offers Keep all only while more than one row is still waiting", () => {
    const group = groups().find((one) => one.kind === "colour")!;
    expect(group.keepAll).toMatch(/^Keep all \d+$/);
    const kept = groupsOf(decideKind(proposal(), "colour", "accepted")).find((one) => one.kind === "colour")!;
    expect(kept.keepAll).toBeNull();
    expect(kept.keptCount).toBe(group.rows.length);
  });

  it("shows the real empty state of a group that found nothing, which names one action", () => {
    const group = groupsOf(proposal({ colours: [] })).find((one) => one.kind === "colour")!;
    expect(group.empty).toContain("Add a palette by hand instead");
    const html = render(createElement(ImportGroup, { group, labels: DECISION_LABELS, busy: false, onDecide: () => undefined, onKeepAll: () => undefined }));
    expect(html).toContain("import-empty-colour");
    expect(html).toContain(group.empty!);
  });

  it("puts the rule beside a row that carries a note", () => {
    const group = groups().find((one) => one.kind === "font")!;
    const withNote = group.rows.find((row) => row.notes.length > 0)!;
    const html = render(createElement(ImportGroup, { group, labels: DECISION_LABELS, busy: false, onDecide: () => undefined, onKeepAll: () => undefined }));
    expect(html).toContain(withNote.notes[0]!.message);
    expect(html).toContain(withNote.notes[0]!.ruleId);
  });
});

describe("the rights row", () => {
  it("starts unticked, and says why nothing of yours will be uploaded", () => {
    const view = importView(proposal());
    expect(view.rights.ticked).toBe(false);
    expect(view.rights.because).toContain("No picture is being kept");
    const html = render(createElement(ImportPanel, { completion: completion(), canEdit: true }));
    // The row only exists once a run has produced a proposal, which a static render has not.
    expect(html).not.toContain("import-rights-tick");
  });

  it("says plainly that this screen does not store a picture, with the gap behind it", () => {
    expect(PICTURES_NOT_SAVED_YET).toContain("read from your site a second time");
  });

  it("asks for the tick before a kept picture could ever be uploaded", () => {
    const kept = decideKind(proposal(), "logo", "accepted");
    expect(importView(kept).rights.because).toBe(importView(kept).rights.ask);
    expect(importView(tickRights(kept, true)).rights.because).toBeNull();
  });
});

describe("what the screen asks to be saved", () => {
  it("is nothing at all while every row is still waiting", () => {
    const changes = changesOf(proposal());
    expect(changes.style).toBeNull();
    expect(changes.colours).toEqual([]);
    expect(changes.fonts).toEqual([]);
  });

  it("is the colours, the fonts with a licence and the three texts the person kept", () => {
    const one = proposal();
    const colour = one.items.find((item) => item.kind === "colour")!;
    const changes = changesOf(decideKind(decide(one, colour.id, "accepted"), "font", "accepted"));
    expect(changes.colours).toEqual([colour.label]);
    expect(changes.colours[0]).toMatch(/^#[0-9a-f]{6}$/);
    for (const font of changes.fonts) expect(font.fontKey.length).toBeGreaterThan(0);
    expect(changes.url).toBe(one.url);
  });

  it("carries the three texts only when the one style row was kept", () => {
    const one = proposal();
    const style = one.items.find((item) => item.kind === "style")!;
    expect(changesOf(decide(one, style.id, "accepted")).style).toEqual(one.style);
    expect(changesOf(decide(one, style.id, "rejected")).style).toBeNull();
  });

  it("says what was saved, naming each part", () => {
    expect(saved(["a palette"])).toContain("a palette");
  });
});

describe("a site that could not be read", () => {
  it("says why and what to do, and offers Try again only where trying may help", () => {
    const slow = errorView(refuse("too_slow"));
    expect(slow.body).toContain("did not answer in time");
    expect(slow.retry).toBe("Try again");
    const robots = errorView(refuse("robots"));
    expect(robots.body).toContain("robots.txt");
    expect(robots.retry).toBeNull();
    // Each reason answers both questions rather than saying only that something went wrong.
    for (const reason of ["not_https", "not_a_page", "too_large", "unreachable", "bad_url", "private_host"] as const) {
      expect(errorView(refuse(reason)).body.length, reason).toBeGreaterThan(40);
    }
  });
});
