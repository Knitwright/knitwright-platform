import { describe, expect, it } from "vitest";
import { anchorLabel, buildThreads, canChange, canResolve, filterThreads, mentionCount, type CommentView } from "./thread";

const NOW = Date.parse("2026-10-28T12:00:00Z");
const at = (minutesAgo: number): string => new Date(NOW - minutesAgo * 60_000).toISOString();

const comment = (over: Partial<CommentView> & { id: string }): CommentView => ({
  parentId: null,
  version: 1,
  panelId: null,
  xMm: null,
  yMm: null,
  body: "Hello",
  authorId: "u1",
  authorName: "Sam",
  createdAt: at(60),
  editedAt: null,
  deletedAt: null,
  resolvedAt: null,
  mentions: [],
  ...over,
});

describe("buildThreads", () => {
  it("puts replies under their first comment, oldest first, and threads oldest first", () => {
    const threads = buildThreads([
      comment({ id: "r2", parentId: "a", createdAt: at(10) }),
      comment({ id: "b", createdAt: at(30) }),
      comment({ id: "a", createdAt: at(50) }),
      comment({ id: "r1", parentId: "a", createdAt: at(20) }),
    ]);
    expect(threads.map((t) => t.root.id)).toEqual(["a", "b"]);
    expect(threads[0]?.replies.map((r) => r.id)).toEqual(["r1", "r2"]);
    expect(threads[1]?.replies).toEqual([]);
  });

  it("orders equal times by id, so the order never depends on how rows came back", () => {
    const rows = [comment({ id: "b", createdAt: at(5) }), comment({ id: "a", createdAt: at(5) })];
    expect(buildThreads(rows).map((t) => t.root.id)).toEqual(["a", "b"]);
    expect(buildThreads([...rows].reverse()).map((t) => t.root.id)).toEqual(["a", "b"]);
  });

  it("drops a reply whose first comment is not in the list, and marks a resolved thread", () => {
    const threads = buildThreads([comment({ id: "x", parentId: "gone" }), comment({ id: "a", resolvedAt: at(1) })]);
    expect(threads.map((t) => [t.root.id, t.resolved])).toEqual([["a", true]]);
  });

  it("does not change what it was given", () => {
    const rows = [comment({ id: "b", createdAt: at(1) }), comment({ id: "a", createdAt: at(2) })];
    const copy = JSON.stringify(rows);
    buildThreads(rows);
    expect(JSON.stringify(rows)).toBe(copy);
  });
});

describe("filterThreads", () => {
  const threads = buildThreads([
    comment({ id: "a", panelId: "front", version: 1 }),
    comment({ id: "b", panelId: "back", version: 2, resolvedAt: at(1) }),
    comment({ id: "c", version: 2 }),
  ]);
  const ids = (list: ReturnType<typeof filterThreads>) => list.map((t) => t.root.id);

  it("shows open threads by default and resolved ones on request", () => {
    expect(ids(filterThreads(threads, { status: "open" }))).toEqual(["a", "c"]);
    expect(ids(filterThreads(threads, { status: "resolved" }))).toEqual(["b"]);
    expect(ids(filterThreads(threads, { status: "all" }))).toEqual(["a", "b", "c"]);
  });

  it("narrows to a panel or a version", () => {
    expect(ids(filterThreads(threads, { status: "all", panelId: "back" }))).toEqual(["b"]);
    expect(ids(filterThreads(threads, { status: "all", version: 2 }))).toEqual(["b", "c"]);
  });
});

describe("canChange", () => {
  const mine = comment({ id: "a", createdAt: at(14) });

  it("lets the author change a comment for 15 minutes", () => {
    expect(canChange(mine, "u1", NOW)).toBe(true);
    expect(canChange(comment({ id: "a", createdAt: at(15) }), "u1", NOW)).toBe(true);
    expect(canChange(comment({ id: "a", createdAt: at(16) }), "u1", NOW)).toBe(false);
  });

  it("refuses someone else, a removed comment and a time that cannot be read", () => {
    expect(canChange(mine, "u2", NOW)).toBe(false);
    expect(canChange(comment({ id: "a", createdAt: at(1), deletedAt: at(0) }), "u1", NOW)).toBe(false);
    expect(canChange(comment({ id: "a", createdAt: "not a time" }), "u1", NOW)).toBe(false);
  });

  it("refuses a comment with no author left", () => {
    expect(canChange(comment({ id: "a", createdAt: at(1), authorId: null }), "u1", NOW)).toBe(false);
  });
});

describe("canResolve", () => {
  it("is for owners, admins and kit managers, not viewers", () => {
    expect(["owner", "admin", "kit_manager", "viewer"].map((role) => canResolve(role as never))).toEqual([true, true, true, false]);
  });
});

describe("mentionCount", () => {
  it("counts open, unremoved comments that name the person", () => {
    const threads = buildThreads([
      comment({ id: "a", mentions: ["me"] }),
      comment({ id: "r", parentId: "a", mentions: ["me"] }),
      comment({ id: "b", mentions: ["me"], resolvedAt: at(1) }),
      comment({ id: "c", mentions: ["other"] }),
      comment({ id: "d", mentions: ["me"], deletedAt: at(1) }),
    ]);
    expect(mentionCount(threads, "me")).toBe(2);
    expect(mentionCount(threads, "nobody")).toBe(0);
  });
});

describe("anchorLabel", () => {
  it("says where a comment is", () => {
    expect(anchorLabel(comment({ id: "a", version: 3 }), () => null)).toBe("Version 3");
    expect(anchorLabel(comment({ id: "a", version: 3, panelId: "front" }), (id) => (id === "front" ? "Front" : null))).toBe("Version 3, Front");
    expect(anchorLabel(comment({ id: "a", version: 3, panelId: "front", xMm: 120, yMm: 45.5 }), () => "Front")).toBe("Version 3, Front at 120 mm across, 45.5 mm down");
    expect(anchorLabel(comment({ id: "a", version: 1, panelId: "odd" }), () => null)).toBe("Version 1, odd");
  });
});
