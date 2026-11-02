import { describe, expect, it } from "vitest";
import { actionSweep, componentSweep, exists, routeSweep } from "./mounted";

/**
 * NOTHING IS BUILT WITH NO DOOR (plan v5, review and hardening; decision 0124).
 *
 * Twice now a whole feature has been built, tested, merged and reachable by nobody: the
 * design-import panel with its five routes and no screen, the artwork panel Brand Studio's own
 * empty state pointed at, the launch packs, and three deletes a person could never press. Each
 * passed the type checker, the unit tests and the coverage floor, because none of those asks
 * whether a person can get to the thing.
 *
 * This test asks, three ways. `componentSweep` walks the imports out of every `app/**` page, layout
 * and route; `actionSweep` looks for a real use of every exported server action; `routeSweep` looks
 * for an address every API route answers on. A component, an action or a route that nothing can
 * reach fails here unless it is in the allow-list below **with its reason**.
 *
 * An API route is the one of the three that may honestly have no caller in this repository: it is a
 * door for something outside the app. So its allow-list entry must name the plan or document that
 * says so, and an entry that cannot name one is an owner question rather than a reason.
 *
 * THE ALLOW-LIST IS NOT A PLACE TO PUT WORK YOU HAVE NOT DONE. Two kinds of entry are allowed:
 *
 *   * `helper` -- a file that is not a screen and is never meant to be mounted: test builders, a
 *     timing harness, a script compiled for a real browser. These stay.
 *   * `in-flight` -- built by one wave and mounted by a wiring pull request that is open right now.
 *     Each entry names that pull request. **Delete the group when it merges.** A stale entry is
 *     reported as a line to remove rather than failing the build, because the order those pull
 *     requests merge in is not this branch's to choose and a red `main` that nobody broke teaches
 *     people to ignore the test.
 */

type Group = Readonly<{
  kind: "helper" | "in-flight";
  /** Why this may be unreachable. The same sentence applies to every path in the group. */
  why: string;
  /** The open pull request that mounts them, for an `in-flight` group. */
  pr: number | null;
  paths: readonly string[];
}>;

const COMPONENT_GROUPS: readonly Group[] = [
  {
    kind: "helper",
    why: "Builders for the media screen's own tests: plain objects in the shape the API sends, imported by tests only.",
    pr: null,
    paths: ["components/media/screen/fixtures.ts"],
  },
  {
    kind: "helper",
    why: "The media run's timing harness (decision 0059). It reports a run as unmeasured; it is not a screen and no page shows it.",
    pr: null,
    paths: ["components/media/screen/timing.ts"],
  },
  {
    kind: "helper",
    why: "Test support for the tech pack and 2D panels: what the editor shell's slot contract hands them. Its own first line says so.",
    pr: null,
    paths: ["components/studio/editor/techpack-view/fixtures.ts"],
  },
  {
    kind: "helper",
    why: "Compiled and run inside a real Chromium by the end-to-end test, on purpose with no imports (spec F-L3), so no page imports it either.",
    pr: null,
    paths: ["components/video/sample-frames.ts"],
  },
  {
    kind: "in-flight",
    why: "Wave 2's editor panels. PR #150 mounts all seven in EditorShell; this branch may not touch that directory.",
    pr: 150,
    paths: [
      "components/studio/editor/export/ExportPanel.tsx",
      "components/studio/editor/export/Preview.tsx",
      "components/studio/editor/export/TabOptions.tsx",
      "components/studio/editor/library/EditGraphicPanel.tsx",
      "components/studio/editor/library/ItemRow.tsx",
      "components/studio/editor/library/LibraryToolbar.tsx",
      "components/studio/editor/library/PatternFillPopover.tsx",
      "components/studio/editor/names-numbers/RosterPreview.tsx",
      "components/studio/editor/names-numbers/colour.ts",
      "components/studio/editor/names-numbers/fonts.ts",
      "components/studio/editor/names-numbers/index.tsx",
      "components/studio/editor/names-numbers/preview.ts",
      "components/studio/editor/names-numbers/state.ts",
      "components/studio/editor/names-numbers/zones.ts",
      "components/studio/editor/repeat-maker/TilePreview.tsx",
      "components/studio/editor/repeat-maker/index.tsx",
      "components/studio/editor/repeat-maker/publish.ts",
      "components/studio/editor/repeat-maker/state.ts",
      "components/studio/editor/repeat-maker/tile-canvas.ts",
      "components/studio/editor/specs/SpecsToolbar.tsx",
      "components/studio/editor/specs/pick-bus.ts",
      "components/studio/editor/techpack-view/Chips.tsx",
      "components/studio/editor/techpack-view/MeasurementsTab.tsx",
      "components/studio/editor/techpack-view/ReviewTab.tsx",
      "components/studio/editor/techpack-view/Sections.tsx",
      "components/studio/editor/techpack-view/TechPackView.tsx",
      "components/studio/editor/view-2d/PatternCanvas.tsx",
      "components/studio/editor/view-2d/PatternView.tsx",
      "components/studio/editor/view-2d/SheetParts.tsx",
    ],
  },
  {
    kind: "in-flight",
    why: "Z1's inspiration board and Z2's Ask box. PR #150 mounts both under the editor's Library toolbar; this branch may not touch those directories.",
    pr: 150,
    paths: [
      "components/inspiration/BoardPanel.tsx",
      "components/inspiration/CardTile.tsx",
      "components/inspiration/InspirationPanel.tsx",
      "components/inspiration/SuggestionList.tsx",
      "components/inspiration/TagChips.tsx",
      "components/inspiration/a11y.ts",
      "components/rulebook/ask/AskAnswer.tsx",
      "components/rulebook/ask/AskBox.tsx",
      "components/rulebook/ask/BestPracticeCard.tsx",
      "components/rulebook/ask/a11y.ts",
    ],
  },
  {
    kind: "in-flight",
    why: "L4's marketing studio. PR #140 mounts it through MARKETING_PANEL_COMPONENTS in the launch rail and inspector; this branch may not touch that directory.",
    pr: 140,
    paths: [
      "components/marketing/ArtboardPreview.tsx",
      "components/marketing/AssistantPanel.tsx",
      "components/marketing/CampaignForm.tsx",
      "components/marketing/ElementsPanel.tsx",
      "components/marketing/ExportPanel.tsx",
      "components/marketing/LayersPanel.tsx",
      "components/marketing/MarketingBoardPanel.tsx",
      "components/marketing/PanelFrame.tsx",
      "components/marketing/PatternFillsPanel.tsx",
      "components/marketing/TemplatePicker.tsx",
      "components/marketing/TextPanel.tsx",
      "components/marketing/panels.ts",
      "components/marketing/services.tsx",
    ],
  },
  {
    kind: "in-flight",
    why: "L3's AI scenes and L5's video studio. PR #140 mounts them in the launch rail and inspector; this branch may not touch those directories.",
    pr: 140,
    paths: [
      "components/shoots/AiImageBoardPanel.tsx",
      "components/shoots/BoardSections.tsx",
      "components/shoots/ShootsPanel.tsx",
      "components/shoots/a11y.ts",
      "components/shoots/panel-model.ts",
      "components/video/AiVideoPanel.tsx",
      "components/video/VideoPlayer.tsx",
      "components/video/VideoStudio.tsx",
      "components/video/copy.ts",
      "components/video/panel-model.ts",
      "components/video/player.ts",
      "components/video/progress.ts",
      "components/video/record-sequence.ts",
      "components/video/studio-model.ts",
    ],
  },
  {
    kind: "in-flight",
    why: "L6's flow canvas, board card, run summary and info card. PR #140 mounts all four in BoardCanvas and the inspector; this branch was told to leave those four files alone.",
    pr: 140,
    paths: [
      "components/flows/FlowBoardCard.tsx",
      "components/flows/FlowCanvas.tsx",
      "components/flows/FlowRunPanel.tsx",
      "components/flows/InfoCardPanel.tsx",
    ],
  },
  {
    kind: "in-flight",
    why: "Flatten, Upscale and Reframe for a selected board. Its door is the board panel of components/launch/{Inspector,LaunchShell}.tsx, which PR #140 is rewriting in exactly that place (it adds the FlowCostSource those three need); wiring it here would collide with that work. Reported in decision 0124 as the one-line follow-up for whoever lands #140.",
    pr: 140,
    paths: ["components/flows/BoardActions.tsx"],
  },
];

const ACTION_GROUPS: readonly Group[] = [
  {
    kind: "in-flight",
    why: "Run all for the whole canvas. PR #140's useLaunchShell calls it and hands the result to FlowRunPanel. It is named in a comment in FlowRunPanel.tsx today, which is why a text search thought it was already used.",
    pr: 140,
    paths: ["lib/flows/actions.ts: runFlowAction"],
  },
  {
    kind: "in-flight",
    why: "The three board operations behind the task bar's More. Same door, and same reason, as components/flows/BoardActions.tsx above: PR #140 owns the file it is wired from.",
    pr: 140,
    paths: ["lib/flows/actions.ts: flowOperationAction"],
  },
  {
    kind: "in-flight",
    why: "Z2's Ask box answers. Owned by PR #150's directory (components/rulebook/ask), which is being wired there now.",
    pr: 150,
    paths: ["lib/rulebook/ask/actions.ts: bestPracticeAction"],
  },
  {
    kind: "helper",
    why: "The Store hand-off, and deliberately not ours: owner decision 1 keeps the Store out of this platform. 'Publish to store' publishes nothing -- the action appends a listing payload to flow_listings for wave 5's Store contract (O2) to collect, as a collection drop is collected. The door belongs to that contract, so no button in this repository may call it, and this entry is here so the next sweep does not re-find it as a bug.",
    pr: null,
    paths: ["lib/flows/actions.ts: publishFlowListingAction"],
  },
];

/**
 * The API routes nothing in this repository fetches. Each entry says **who the door is for**: a
 * plan or document that names it, or, where nothing does, the owner question that has to be
 * answered before it gets a caller or gets removed (decision 0124).
 */
const ROUTE_GROUPS: readonly Group[] = [
  {
    kind: "helper",
    why: "Named as a door in plans/production-outputs.md (W3's print profiles: `apps/web/app/api/print-profiles/**`), so the caller is outside this app.",
    pr: null,
    paths: ["/api/print-profiles", "/api/print-profiles/rules", "/api/print-profiles/rules/[ruleId]"],
  },
  {
    kind: "helper",
    why: "Named as a door in plans/platform-v4.md (`app/api/templates/**`, the template library), so the caller is outside this app.",
    pr: null,
    paths: ["/api/templates"],
  },
  {
    kind: "helper",
    why: "Who is signed in, for the account menu the owner chose for the top bar. Its own line says so and its route test exercises it; the menu reads it in the browser rather than through an import.",
    pr: null,
    paths: ["/api/me"],
  },
  {
    kind: "helper",
    why: "DARK ON PURPOSE. Its POST is gated behind `patternLibraryOpenTo` (lib/patterns/access.ts) and answers \"The pattern library is not open yet\" to everyone else, so having no screen is the state the gate describes rather than a hole. The screen belongs with opening the library (decision 0124).",
    pr: null,
    paths: ["/api/pattern-library/programmes"],
  },
];

const entries = (groups: readonly Group[]): readonly Readonly<{ path: string; group: Group }>[] =>
  groups.flatMap((group) => group.paths.map((path) => ({ path, group })));

const allowed = (groups: readonly Group[]): ReadonlySet<string> => new Set(entries(groups).map((entry) => entry.path));

/** A stale entry is a line to delete, printed rather than thrown. See the note at the top. */
const reportStale = (kind: string, stale: readonly string[]): void => {
  if (stale.length > 0) console.warn(`${kind}: ${stale.length} allow-list entries are no longer needed. Delete them:\n${stale.join("\n")}`);
};

describe("every component has a door", () => {
  const sweep = componentSweep();

  it("looks at the whole app, from every page, layout and route", () => {
    // A floor on the sweep itself: with no roots or no files, the check below would pass vacuously.
    expect(sweep.roots.length).toBeGreaterThan(100);
    expect(sweep.files.length).toBeGreaterThan(1500);
    expect(sweep.reached.size).toBeGreaterThan(1000);
    expect(sweep.files.filter((path) => path.startsWith("components/")).length).toBeGreaterThan(300);
  });

  it("reaches a component a page really draws, and does not reach one nothing imports", () => {
    // The traversal works: the studio home draws these, through two and three hops.
    expect(sweep.reached.has("components/home/DesignCard.tsx")).toBe(true);
    expect(sweep.reached.has("components/studio/home/ActionCards.tsx")).toBe(true);
    // And it can tell: a test builder nothing mounts is not reachable.
    expect(sweep.reached.has("components/media/screen/fixtures.ts")).toBe(false);
  });

  it("mounts the panels this branch gave a door, so the sweep would see a door go away", () => {
    for (const path of [
      "components/design-import/DesignImportPanel.tsx",
      "components/design-import/SideBySide.tsx",
      "components/artwork/ArtworkPanel.tsx",
      "components/artwork/ArtworkCard.tsx",
      "components/artwork/generators/GeneratorGallery.tsx",
      "components/flows/FlowTemplates.tsx",
      "components/flows/FlowThumbnail.tsx",
      "components/collections/RemoveStyle.tsx",
      "components/deletion/DeleteForm.tsx",
    ]) {
      expect(sweep.reached.has(path), path).toBe(true);
    }
  });

  it("leaves no component unreachable but the ones named below, each with its reason", () => {
    const allow = allowed(COMPONENT_GROUPS);
    expect(sweep.unmounted.filter((path) => !allow.has(path))).toEqual([]);
    reportStale("components", [...allow].filter((path) => sweep.reached.has(path)).sort());
  });
});

describe("every server action has a caller", () => {
  const sweep = actionSweep();

  it("looks at every \"use server\" module in the app", () => {
    expect(sweep.modules.length).toBeGreaterThan(20);
    expect(sweep.actions.length).toBeGreaterThan(100);
    expect(sweep.actions).toContain("lib/deletion/actions.ts: deleteDesignAction");
  });

  it("counts a real use and not a name passed along by a barrel or written in a comment", () => {
    // Pressed by a form: `<DeleteForm action={deleteDesignAction} …>`.
    expect(sweep.unused).not.toContain("lib/deletion/actions.ts: deleteDesignAction");
    // The three deletes this branch gave a door.
    expect(sweep.unused).not.toContain("lib/collections/actions.ts: removeCollectionAction");
    expect(sweep.unused).not.toContain("lib/collections/actions.ts: removeStyleAction");
    expect(sweep.unused).not.toContain("lib/launch/actions.ts: removeLaunchProjectAction");
    expect(sweep.unused).not.toContain("lib/flows/actions.ts: applyFlowTemplateAction");
  });

  it("leaves no action uncalled but the ones named below, each with its reason", () => {
    const allow = allowed(ACTION_GROUPS);
    expect(sweep.unused.filter((entry) => !allow.has(entry))).toEqual([]);
    reportStale("server actions", [...allow].filter((entry) => !sweep.unused.includes(entry)).sort());
  });
});

describe("every API route is a door somebody knocks on", () => {
  const sweep = routeSweep();

  it("looks at every route under app/api, dynamic segments and all", () => {
    expect(sweep.routes.length).toBeGreaterThan(80);
    // A route in a directory called `tests` is still a route. It was skipped once; it is not now.
    expect(sweep.routes).toContain("/api/fabrics/[fabricId]/tests");
    expect(sweep.routes).toContain("/api/design-import/[importId]/refit");
  });

  it("sees the undo this branch gave a brand: the size-map route has a caller now", () => {
    expect(sweep.routes).toContain("/api/fabrics/size-map");
    expect(sweep.unfetched).not.toContain("/api/fabrics/size-map");
  });

  it("finds the address a screen writes down, whether plainly or around an id", () => {
    // `/api/artwork` and `/api/artwork/${id}/tile` are both written in `lib/artwork-intake/client.ts`.
    expect(sweep.unfetched).not.toContain("/api/artwork");
    expect(sweep.unfetched).not.toContain("/api/artwork/[artworkId]/tile");
    // The design-import panel now has a screen, so its routes have callers again.
    expect(sweep.unfetched).not.toContain("/api/design-import");
    expect(sweep.unfetched).not.toContain("/api/design-import/[importId]/refit");
  });

  it("leaves no route unfetched but the ones named below, each with who its door is for", () => {
    const allow = allowed(ROUTE_GROUPS);
    expect(sweep.unfetched.filter((address) => !allow.has(address))).toEqual([]);
    reportStale("api routes", [...allow].filter((address) => !sweep.unfetched.includes(address)).sort());
  });
});

describe("the allow-list itself", () => {
  const all = [...entries(COMPONENT_GROUPS), ...entries(ACTION_GROUPS), ...entries(ROUTE_GROUPS)];

  it("names a file that is really there, so an entry cannot outlive its file", () => {
    const missing = all
      .map((entry) => entry.path.split(": ")[0]!)
      .filter((path) => !path.startsWith("/api/"))
      .filter((path) => !exists(path));
    expect([...new Set(missing)]).toEqual([]);
  });

  it("names a route that is really there, so an entry cannot outlive its route", () => {
    const addresses = new Set(routeSweep().routes);
    expect(entries(ROUTE_GROUPS).map((entry) => entry.path).filter((address) => !addresses.has(address))).toEqual([]);
  });

  it("gives every entry a reason, and every in-flight entry the pull request that mounts it", () => {
    for (const { path, group } of all) {
      expect(group.why.length, path).toBeGreaterThan(60);
      expect(group.kind === "in-flight" ? group.pr : null, path).not.toBe(undefined);
      if (group.kind === "in-flight") expect(group.pr, path).toBeGreaterThan(0);
      else expect(group.pr, path).toBeNull();
    }
  });

  it("holds each path once, so two reasons cannot disagree about the same file", () => {
    const paths = all.map((entry) => entry.path);
    expect(new Set(paths).size).toBe(paths.length);
  });
});
