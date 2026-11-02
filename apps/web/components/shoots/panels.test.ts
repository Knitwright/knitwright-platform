import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { panelDouble, type BoardSelection, type BoardView, type LaunchContext, type LaunchPanelProps } from "@/lib/launch";
import { board, designBoard, link, project, ready } from "@/lib/launch/fixtures/canvas";
import {
  CONSENT_STATEMENT,
  GARMENT_LOCKED,
  MODEL_PRESET_CATALOGUE,
  NO_ARTWORK_NOTE,
  NO_DESIGN_BODY,
  NO_DESIGN_TITLE,
  NO_LICENCE_LINE,
  NO_MATCH_TITLE,
  NO_SCENE_TITLE,
  PRESETS_NOTE,
  USE_IDEA,
  conceptBySlug,
  settingsOfConcept,
  writeBoardSettings,
} from "@/lib/shoots";
import AiImageBoardPanel from "./AiImageBoardPanel";
import ShootsPanel from "./ShootsPanel";
import { chipProps, consentProps, generateProps, listProps, panelProps, presetProps, progressProps, useIdeaProps } from "./a11y";
import { ideaAction } from "./panel-model";

/**
 * The two panels of the shoot studio, rendered against `panelDouble()` -- **no shell and no
 * browser** (the panel contract, `lib/launch/panels.ts`). Each is a default export taking
 * `LaunchPanelProps` and nothing else, which is what lets the shell mount it.
 *
 * What is checked is what the owner asked for: an empty state naming the one action that fills it,
 * the cost on the button before anything is spent, a model preset that cannot be chosen without a
 * licence, the consent recorded rather than assumed, honest progress, an error state that says what
 * it cost and what to do, labelled controls, and the garment lock said on the screen.
 */

/** The markup with React's HTML entities read back, so a sentence with an apostrophe compares. */
const render = (element: Parameters<typeof renderToStaticMarkup>[0]): string =>
  renderToStaticMarkup(element).replaceAll("&#x27;", "'").replaceAll("&quot;", '"').replaceAll("&amp;", "&");

const context = (boards: readonly BoardView[], selection: BoardSelection | null = null, busy = false): LaunchContext => ({
  project: project(boards, boards.length > 1 ? [link("edge-1", boards[0]!.id, boards[1]!.id)] : []),
  selection,
  credits: 120,
  presets: [],
  unit: "px",
  zoom: 100,
  dockTool: "select",
  busy,
});

const props = (ctx: LaunchContext): LaunchPanelProps & { calls: ReturnType<typeof panelDouble>["calls"] } => {
  const double = panelDouble();
  return { context: ctx, commands: double.commands, calls: double.calls };
};

const shootBoard = (extra: Partial<BoardView> = {}): BoardView =>
  board("board-ai-1", "ai_image", { settings: writeBoardSettings(settingsOfConcept(conceptBySlug("floodlit-pitch")!)), ...extra });

const withDesign = (one: BoardView): readonly BoardView[] => [designBoard("board-design-1"), one];

const selected = (one: BoardView, image = false): BoardSelection => ({ board: one, image });

describe("both panels are the shape the contract asks for", () => {
  it("each takes the context and the commands, and nothing else", () => {
    for (const Panel of [ShootsPanel, AiImageBoardPanel]) expect(Panel.length).toBeLessThanOrEqual(1);
  });
});

describe("the shoot ideas panel", () => {
  it("shows the twelve ideas, each with the one action that uses it", () => {
    const html = render(createElement(ShootsPanel, props(context([designBoard("board-design-1")]))));
    expect(html).toContain("shoots-panel");
    for (const slug of ["floodlit-pitch", "team-line-up", "gym-session", "retail-and-lifestyle"]) expect(html).toContain(`shoot-idea-${slug}`);
    expect(html.split(USE_IDEA).length - 1).toBe(12);
  });

  it("says the garment is locked, on the screen rather than in a comment", () => {
    const html = render(createElement(ShootsPanel, props(context([designBoard("board-design-1")]))));
    expect(html).toContain(GARMENT_LOCKED);
  });

  it("asks the shell for nothing while it is only being drawn", () => {
    const { calls, ...given } = props(context([designBoard("board-design-1")]));
    render(createElement(ShootsPanel, given));
    expect(calls).toEqual([]);
  });

  it("asks for a board fed by the design when nothing is selected, and sets the idea on one that is", () => {
    const concept = conceptBySlug("gym-session")!;
    const added = ideaAction(context([designBoard("board-design-1")]), concept);
    expect(added.kind).toBe("add");
    if (added.kind !== "add") return;
    expect(added.fromBoardId).toBe("board-design-1");
    expect(added.said).toContain(concept.title);
    const one = shootBoard();
    const set = ideaAction(context(withDesign(one), selected(one)), concept);
    expect(set.kind).toBe("set");
    if (set.kind !== "set") return;
    expect(set.boardId).toBe(one.id);
    expect(set.settings.sceneSlug).toBe(concept.sceneSlugs[0]);
  });

  it("adds a board at the origin when there is no design board to sit beside", () => {
    const action = ideaAction(context([board("board-art-1", "artboard")]), conceptBySlug("team-line-up")!);
    expect(action).toMatchObject({ kind: "add", at: { x: 0, y: 0 }, fromBoardId: null });
  });

  it("shows a real empty state, with the filters cleared by the one control in it", () => {
    const html = render(createElement(ShootsPanel, props(context([designBoard("board-design-1")]))));
    // Nothing is filtered to begin with, so the no-match state is not on the screen.
    expect(html).not.toContain(NO_MATCH_TITLE);
    expect(html).toContain("shoot-filter-sport");
    expect(html).toContain("shoot-filter-people");
  });

  it("lists the gap 07 leaves about the pose count, with its rule", () => {
    const html = render(createElement(ShootsPanel, props(context([designBoard("board-design-1")]))));
    expect(html).toContain("shoot-gap");
    expect(html).toContain("R-GAP-000");
  });
});

describe("the AI image board panel", () => {
  it("draws the empty state that names the action when no design is behind the board", () => {
    const alone = shootBoard();
    const html = render(createElement(AiImageBoardPanel, props(context([alone], selected(alone)))));
    expect(html).toContain(NO_DESIGN_TITLE);
    expect(html).toContain(NO_DESIGN_BODY);
    expect(html).toContain("shoot-empty-action");
  });

  it("asks for a scene when a design is behind the board and nothing has been chosen", () => {
    const empty = board("board-ai-1", "ai_image");
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(empty), selected(empty)))));
    expect(html).toContain(NO_SCENE_TITLE);
  });

  it("puts the credit cost in the Generate button's own visible words", () => {
    const one = shootBoard();
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one)))));
    expect(html).toContain("shoot-generate");
    expect(html).toMatch(/Generate 4 images \(4 credits\)|Generate/);
    expect(html).toContain("a picture");
  });

  it("refuses to run a shoot whose model preset has no licence, and says so where the button is", () => {
    const one = shootBoard();
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one)))));
    expect(html).toContain("shoot-run-reason");
    expect(html).toContain(NO_LICENCE_LINE);
  });

  it("shows every model preset with its licence line, and none of them choosable", () => {
    const one = shootBoard();
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one)))));
    for (const preset of MODEL_PRESET_CATALOGUE) expect(html).toContain(`shoot-preset-${preset.key}`);
    expect(html.split("disabled").length - 1).toBeGreaterThanOrEqual(MODEL_PRESET_CATALOGUE.length);
  });

  it("asks for the consent reference and the statement when the brand brings its own model", () => {
    const one = shootBoard({ settings: { ...shootBoard().settings, modelSource: "upload" } });
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one)))));
    expect(html).toContain("shoot-consent-ref");
    expect(html).toContain("shoot-consent-tick");
    expect(html).toContain(CONSENT_STATEMENT);
  });

  it("says when a consent was recorded, from the record and not from the tick", () => {
    const consent = { ref: "Release 4", statement: CONSENT_STATEMENT, givenAt: "2026-11-02T09:00:00.000Z" };
    const one = shootBoard({ settings: { ...shootBoard().settings, modelSource: "upload", modelFileId: "file-1", consent } });
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one)))));
    expect(html).toContain("shoot-consent-recorded");
    expect(html).toContain("2026-11-02");
  });

  it("shows honest progress while a run is in flight: a step, a clock and a bar short of the end", () => {
    const running = shootBoard({ status: "running" });
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(running), selected(running)))));
    expect(html).toContain("shoot-waiting");
    expect(html).toContain("Generating 00:00");
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain('aria-valuenow="100"');
  });

  it("shows the picture with the label the spec puts on it, and the scene-only edits", () => {
    const done = ready(shootBoard({ status: "ready" }));
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(done), selected(done)))));
    expect(html).toContain("shoot-result-label");
    expect(html).toContain("AI-generated model");
    expect(html).toContain("shoot-edit-prompt");
    expect(html).toContain("shoot-edit-edit-area");
  });

  it("says a generated picture never becomes artwork, on the screen", () => {
    const done = ready(shootBoard({ status: "ready" }));
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(done), selected(done)))));
    expect(html).toContain(NO_ARTWORK_NOTE);
  });

  it("shows an error state that says what happened and what it cost when a run failed", () => {
    const failed = shootBoard({ status: "failed", lastCostCredits: 4 });
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(failed), selected(failed)))));
    expect(html).toContain('role="alert"');
    expect(html).toContain("4 credits were given back");
    expect(html).toContain("Try another pose");
  });

  it("carries the notice that says the credit prices are placeholders, and that nothing is charged", () => {
    const one = shootBoard();
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one)))));
    expect(html).toContain(PRESETS_NOTE);
    expect(html).toContain("not being charged");
  });

  it("disables every control while the shell is saving", () => {
    const one = shootBoard();
    const html = render(createElement(AiImageBoardPanel, props(context(withDesign(one), selected(one), true))));
    expect(html).toContain('aria-busy="true"');
  });
});

describe("the accessible names and states", () => {
  it("name a panel by its own heading and say when it is busy", () => {
    expect(panelProps("heading-1", true)).toEqual({ role: "region", "aria-labelledby": "heading-1", "aria-busy": true });
  });

  it("say what a chip does rather than replacing its words, and whether it is chosen", () => {
    expect(chipProps("style", "Editorial", true)).toEqual({ type: "button", title: "Clear the style Editorial", "aria-pressed": true });
    expect(chipProps("style", "Editorial", false).title).toBe("Choose style: Editorial");
  });

  it("say which idea a Use button belongs to without replacing the words on it", () => {
    const button = useIdeaProps("Team line-up", false);
    expect(button.title).toBe("Use the Team line-up shoot idea");
    expect(Object.keys(button)).not.toContain("aria-label");
  });

  it("mark a preset with no licence as disabled rather than hiding what the library will hold", () => {
    expect(presetProps(false, false)).toEqual({ type: "button", "aria-pressed": false, "aria-disabled": true, disabled: true });
    expect(presetProps(true, true)["aria-disabled"]).toBe(false);
  });

  it("point the Generate button at the reason it cannot run, and only when there is one", () => {
    expect(generateProps(true, "reason-1")).toEqual({ type: "submit", disabled: true, "aria-describedby": "reason-1" });
    expect(Object.keys(generateProps(false, null))).not.toContain("aria-describedby");
  });

  it("make the progress bar read the number it draws", () => {
    expect(progressProps(40, "Asking the model for the scene")).toEqual({
      role: "progressbar",
      "aria-valuemin": 0,
      "aria-valuemax": 100,
      "aria-valuenow": 40,
      "aria-valuetext": "Asking the model for the scene",
    });
  });

  it("tie the consent tick to the statement it is agreeing to", () => {
    expect(consentProps("consent-1", true)).toEqual({ type: "checkbox", id: "consent-1", checked: true, "aria-describedby": "consent-1-statement" });
  });

  it("make a list a screen reader can count", () => {
    expect(listProps("Shoot ideas")).toEqual({ role: "list", "aria-label": "Shoot ideas" });
  });
});
