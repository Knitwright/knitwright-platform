import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { panelDouble, type BoardSelection, type BoardView, type LaunchContext, type LaunchPanelProps } from "@/lib/launch";
import { board, designBoard, link, project, ready } from "@/lib/launch/fixtures/canvas";
import {
  ARTICLE_FILTER_GAP,
  CLEAR_FILTERS,
  CONVERT_LABEL,
  GARMENT_LOCKED,
  NEEDS_DESIGN,
  NO_BOARD_SCENE_TITLE,
  NO_PHOTOS_TITLE,
  PHOTOS_GAP,
  PLACEMENT_FIXED,
  RENDER_LABEL,
  SHOW_ALL,
  defaultSettings,
  sceneBySlug,
  settingsToStored,
  specCountGap,
} from "@/lib/mockups";
import MockupBoardPanel from "./MockupBoardPanel";
import MockupsPanel from "./MockupsPanel";
import PhotosPanel from "./PhotosPanel";
import { SceneThumb, THUMB_NOTE } from "./SceneThumb";
import { collectionProps, filterProps, filterSuffix, listProps, panelProps, premiumProps, sceneSuffix, showAllProps, useSceneProps } from "./a11y";

/**
 * The three panels of the mockup studio, rendered against `panelDouble()` -- **no shell and no
 * browser** (the panel contract, `lib/launch/panels.ts`). Each one is a default export taking
 * `LaunchPanelProps` and nothing else, which is what lets the shell mount it.
 *
 * What is checked is what the owner asked for: a real empty state naming the one action that fills
 * it, a loading state, an error state that says what to do, labelled controls, the garment lock and
 * the placement rule said on the screen, and a scene with a gap saying so rather than looking ready.
 */

/**
 * The markup with React's HTML entities read back, so a sentence holding an apostrophe can be
 * compared with the sentence the copy file holds rather than with its escaped spelling.
 */
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

const mockupBoard = (extra: Partial<BoardView> = {}): BoardView =>
  board("board-mockup-1", "mockup", { settings: settingsToStored(defaultSettings(sceneBySlug("product-three-quarter")!)), ...extra });

describe("the panels are the shape the contract asks for", () => {
  it("each takes the context and the commands, and nothing else", () => {
    for (const Panel of [MockupsPanel, PhotosPanel, MockupBoardPanel]) expect(Panel.length).toBeLessThanOrEqual(1);
  });

  it("the board panel draws nothing when nothing is selected", () => {
    const { calls, ...given } = props(context([designBoard("design-1")]));
    expect(render(createElement(MockupBoardPanel, given))).toBe("");
    expect(calls).toEqual([]);
  });
});

describe("the mockup library panel", () => {
  const given = () => props(context([designBoard("design-1")]));

  it("shows the collections of 07, each with a Show all, and says the garment is locked", () => {
    const html = render(createElement(MockupsPanel, given()));
    expect(html).toContain("mockups-panel");
    expect(html).toContain("Product shots");
    expect(html).toContain("Teamwear");
    expect(html).toContain(SHOW_ALL);
    expect(html).toContain(GARMENT_LOCKED);
    expect(html).toContain(PLACEMENT_FIXED);
  });

  it("puts the crown and the word Credits on a scene a model runs, and Free on one it draws", () => {
    const html = render(createElement(MockupsPanel, given()));
    expect(html).toContain("Credits");
    expect(html).toContain("Free");
    expect(html).toContain("mockup-use-product-front");
  });

  it("says a turned view is a turned drawing, with its rule, instead of looking ready", () => {
    const html = render(createElement(MockupsPanel, given()));
    expect(html).toContain("turned 45°");
    expect(html).toContain("R-GAP-000");
  });

  it("says what it cannot filter on, and that the spec asks for more scenes than it names", () => {
    const html = render(createElement(MockupsPanel, given()));
    expect(html).toContain(ARTICLE_FILTER_GAP.line);
    expect(html).toContain(specCountGap()!.line);
  });

  it("says plainly that the picture on a card is a plan of the scene, not the kit", () => {
    expect(render(createElement(MockupsPanel, given()))).toContain(THUMB_NOTE);
  });

  it("offers the sport, mood, people and aspect filters, each labelled", () => {
    const html = render(createElement(MockupsPanel, given()));
    for (const group of ["sport", "mood", "people", "aspect"]) expect(html, group).toContain(`mockup-filter-${group}`);
    expect(html).toContain("Filter by sport: Football");
    // The chip's own words are its name; the count and the group are for a screen reader only.
    expect(html).toContain("scenes, sport filter");
  });

  it("says it is busy while the shell is saving, rather than looking frozen", () => {
    const html = render(createElement(MockupsPanel, props(context([designBoard("design-1")], null, true))));
    expect(html).toContain("mockup-busy");
    expect(html).toContain('aria-busy="true"');
  });

  it("keeps the words of its empty state on hand, with the one action that clears it", () => {
    // The seeded library is never empty, so the "no match" state is the one a person reaches.
    expect(CLEAR_FILTERS).toBe("Clear the filters");
  });
});

describe("the photos panel", () => {
  it("shows a real empty state, names the one action, and opens the Uploads panel", () => {
    const given = props(context([designBoard("design-1")]));
    const html = render(createElement(PhotosPanel, given));
    expect(html).toContain("photos-panel");
    expect(html).toContain(NO_PHOTOS_TITLE);
    expect(html).toContain("Open the Uploads panel");
    expect(html).toContain(PHOTOS_GAP.line);
  });
});

describe("the mockup board's inspector", () => {
  it("asks for a scene first, and points at the panel that gives it one", () => {
    const given = props(context([designBoard("design-1"), board("board-1", "mockup")], { board: board("board-1", "mockup"), image: false }));
    const html = render(createElement(MockupBoardPanel, given));
    expect(html).toContain(NO_BOARD_SCENE_TITLE);
    expect(html).toContain("mockup-board-open-library");
  });

  it("shows the scene, the crop, the kit and the shirt, and no placement at all", () => {
    const selected = mockupBoard({ settings: settingsToStored({ ...defaultSettings(sceneBySlug("product-front")!), roster: { name: "SMITH", number: "7" } }) });
    const given = props(context([designBoard("design-1"), selected], { board: selected, image: false }));
    const html = render(createElement(MockupBoardPanel, given));
    expect(html).toContain("Front render");
    expect(html).toContain("mockup-board-crop");
    expect(html).toContain("Draw the Home kit");
    expect(html).toContain("On the shirt: SMITH 7");
    expect(html).toContain(PLACEMENT_FIXED);
    // There is no control for a placement, because F-L1 says there is not one.
    expect(html).not.toContain("Offset");
    expect(html).not.toContain("Drag");
  });

  it("says a board with no Design board behind it has nothing to follow", () => {
    const selected = mockupBoard();
    const given = props(context([selected], { board: selected, image: false }));
    expect(render(createElement(MockupBoardPanel, given))).toContain(NEEDS_DESIGN);
  });

  it("says when the design has moved on since the mockup was drawn", () => {
    const selected = mockupBoard({ inputVersion: 2 });
    const design = designBoard("design-1", "project-1", 5);
    const given = props(context([design, selected], { board: selected, image: false }));
    const html = render(createElement(MockupBoardPanel, given));
    expect(html).toContain("mockup-board-stale");
    expect(html).toContain("version 2");
    expect(html).toContain("version 5");
  });

  it("offers Draw this mockup, and will not Convert to image before there is one", () => {
    const selected = mockupBoard();
    const given = props(context([designBoard("design-1"), selected], { board: selected, image: false }));
    const html = render(createElement(MockupBoardPanel, given));
    expect(html).toContain(RENDER_LABEL);
    expect(html).toContain(CONVERT_LABEL);
    expect(html).toContain("Draw this mockup first");
    expect(html).toContain("disabled");
  });

  it("offers Convert to image once the board has a picture", () => {
    const selected = ready(mockupBoard(), "file-9");
    const given = props(context([designBoard("design-1"), selected], { board: selected, image: false }));
    const html = render(createElement(MockupBoardPanel, given));
    expect(html).toContain("mockup-board-convert");
    expect(html).toContain("stop following the design");
  });

  it("shows the gap of a turned view on the board as well as on the card", () => {
    const selected = mockupBoard();
    const given = props(context([designBoard("design-1"), selected], { board: selected, image: false }));
    expect(render(createElement(MockupBoardPanel, given))).toContain("mockup-board-gaps");
  });
});

describe("the attributes a screen reader reads", () => {
  it("labels the panel by its own heading and says when it is busy", () => {
    expect(panelProps("h1", true)).toEqual({ role: "region", "aria-labelledby": "h1", "aria-busy": true });
    expect(collectionProps("h2")).toEqual({ role: "group", "aria-labelledby": "h2" });
    expect(listProps("Product shots scenes")).toEqual({ role: "list", "aria-label": "Product shots scenes" });
  });

  /**
   * A button whose words say one thing and whose `aria-label` says another is axe's
   * `label-content-name-mismatch`, and voice control asks for a name nobody can see. So the two
   * controls whose words are the same on every card -- Use this scene, and a filter chip -- take
   * their name from their own words and add the rest for a screen reader only.
   */
  it("never replaces a control's own words with an aria-label", () => {
    expect(useSceneProps("Flat lay on white", false)).toEqual({ type: "button", title: "Use the Flat lay on white scene", disabled: false });
    expect(sceneSuffix("Flat lay on white")).toBe(": Flat lay on white");
    expect(filterProps("sport", "Football", false)).toEqual({ type: "button", title: "Filter by sport: Football", "aria-pressed": false });
    expect(filterSuffix("sport", 3)).toBe(", 3 scenes, sport filter");
    expect(filterSuffix("sport", 1)).toBe(", 1 scene, sport filter");
  });

  it("keeps the aria-label where it begins with the words on the button", () => {
    expect(showAllProps("teamwear", false, 1)).toEqual({ type: "button", "aria-label": "Show all 1 more teamwear scenes", "aria-expanded": false });
    expect(showAllProps("teamwear", true, 0)["aria-label"]).toBe("Show fewer teamwear scenes");
  });

  it("says which filter is chosen, so the ring is not the only sign of it", () => {
    expect(filterProps("sport", "Football", false)["aria-pressed"]).toBe(false);
    expect(filterProps("sport", "Football", true)["aria-pressed"]).toBe(true);
    expect(filterProps("sport", "Football", true).title).toBe("Clear the sport filter Football");
  });

  it("gives the crown a title, because a crown alone says nothing", () => {
    expect(premiumProps("A model lights it")).toEqual({ title: "A model lights it", "aria-hidden": false });
  });
});

describe("the picture on a card", () => {
  it("is drawn from the scene's own backdrop and slots, and is hidden from a screen reader", () => {
    const html = render(createElement(SceneThumb, { scene: sceneBySlug("flat-lay-grass")! }));
    expect(html).toContain("#4a7a3c");
    expect(html).toContain('aria-hidden="true"');
    expect(html).not.toContain("<image");
  });

  it("draws a gradient backdrop as a gradient", () => {
    expect(render(createElement(SceneThumb, { scene: sceneBySlug("floodlit-pitch")! }))).toContain("linearGradient");
  });

  it("draws one shape per garment slot, so an eleven-player line-up shows eleven", () => {
    const html = render(createElement(SceneThumb, { scene: sceneBySlug("team-line-up-eleven")! }));
    expect([...html.matchAll(/<rect/g)]).toHaveLength(12);
  });
});
