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
 *     people to ignore the test. PR #140 merged while this branch was being written and its
 *     thirty-one entries were deleted the same hour, which is the mechanism working.
 *   * `reported` -- a seam whose door is a file another workstream owns, written down in a decision
 *     record with the lines it takes, so the next person finds the answer rather than the hole.
 */

type Group = Readonly<{
  kind: "helper" | "in-flight" | "reported";
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
];

const ACTION_GROUPS: readonly Group[] = [
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

  it("leaves the test trees out, so a test can never stand in for a caller", () => {
    // Both are skipped by their path from the app root. A helper in either of them naming an action
    // or an address would otherwise make a thing no person can reach look reached.
    for (const path of ["e2e/support.ts", "e2e/chrome.ts", "tests/architecture/mounted.ts", "tests/stubs/server-only.ts"]) {
      expect(sweep.files, path).not.toContain(path);
    }
    // And a route in a directory called `tests` is still a route, so the skip is by path, not name.
    expect(sweep.files).toContain("app/api/fabrics/[fabricId]/tests/route.ts");
  });

  it("reaches a component a page really draws, and does not reach one nothing imports", () => {
    // The traversal works: Recent (the old studio home) draws these, through two and three hops.
    expect(sweep.reached.has("components/home/DesignCard.tsx")).toBe(true);
    expect(sweep.reached.has("components/projects/v3/StartCards.tsx")).toBe(true);
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
