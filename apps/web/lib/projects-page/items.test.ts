import { describe, expect, it } from "vitest";
import {
  folderCounts,
  isProjectKind,
  itemHref,
  matches,
  projectCount,
  searchFromQuery,
  sortFromQuery,
  visibleFolders,
  visibleItems,
  type ProjectItem,
} from "./items";

const item = (over: Partial<ProjectItem> & Pick<ProjectItem, "id" | "name">): ProjectItem => ({
  kind: "design",
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-01T10:00:00Z",
  artboards: null,
  detail: "Crew tee",
  folderId: null,
  trashedAt: null,
  ...over,
});

const ITEMS: readonly ProjectItem[] = [
  item({ id: "a", name: "Away kit", updatedAt: "2026-11-05T00:00:00Z", createdAt: "2026-10-01T00:00:00Z", folderId: "f1" }),
  item({ id: "b", name: "home kit", updatedAt: "2026-11-09T00:00:00Z", createdAt: "2026-10-05T00:00:00Z" }),
  item({ id: "c", kind: "launch", name: "Launch day", detail: "Launch pack", artboards: 4, updatedAt: "2026-11-07T00:00:00Z", createdAt: "2026-09-01T00:00:00Z" }),
  item({ id: "d", name: "Old training top", trashedAt: "2026-11-10T00:00:00Z", folderId: "f1" }),
  item({ id: "e", name: "Old polo", trashedAt: "2026-11-11T00:00:00Z" }),
];

const ids = (items: readonly ProjectItem[]) => items.map((entry) => entry.id);

describe("the query", () => {
  it("reads a known sort and falls back to recent", () => {
    expect(sortFromQuery("name")).toBe("name");
    expect(sortFromQuery(["oldest", "name"])).toBe("oldest");
    expect(sortFromQuery("sideways")).toBe("recent");
    expect(sortFromQuery(undefined)).toBe("recent");
  });

  it("trims the search and cuts it to 80 characters", () => {
    expect(searchFromQuery("  kit ")).toBe("kit");
    expect(searchFromQuery("x".repeat(200))).toHaveLength(80);
    expect(searchFromQuery(undefined)).toBe("");
  });
});

describe("the list", () => {
  it("leaves the Trash out, newest change first", () => {
    expect(ids(visibleItems(ITEMS, { search: "", sort: "recent" }))).toEqual(["b", "c", "a"]);
  });

  it("sorts by name ignoring case, and by when each was made", () => {
    expect(ids(visibleItems(ITEMS, { search: "", sort: "name" }))).toEqual(["a", "b", "c"]);
    expect(ids(visibleItems(ITEMS, { search: "", sort: "oldest" }))).toEqual(["c", "a", "b"]);
  });

  it("searches the name and the kind", () => {
    expect(ids(visibleItems(ITEMS, { search: "KIT", sort: "recent" }))).toEqual(["b", "a"]);
    expect(ids(visibleItems(ITEMS, { search: "launch pack", sort: "recent" }))).toEqual(["c"]);
    expect(matches(ITEMS[0]!, "  ")).toBe(true);
  });

  it("shows one folder's items, and the Trash newest-trashed first", () => {
    expect(ids(visibleItems(ITEMS, { search: "", sort: "recent", folderId: "f1" }))).toEqual(["a"]);
    expect(ids(visibleItems(ITEMS, { search: "", sort: "recent", trashed: true }))).toEqual(["e", "d"]);
    expect(ids(visibleItems(ITEMS, { search: "", sort: "name", trashed: true }))).toEqual(["e", "d"]);
  });

  it("opens a design in the editor and a launch project on its canvas", () => {
    expect(itemHref({ kind: "design", id: "a" })).toBe("/studio/a");
    expect(itemHref({ kind: "launch", id: "c" })).toBe("/launch/c");
    expect(isProjectKind("launch")).toBe(true);
    expect(isProjectKind("moodboard")).toBe(false);
  });
});

describe("folders", () => {
  const folders = folderCounts(
    [
      { id: "f1", name: "Home kits", createdAt: "2026-10-01T00:00:00Z" },
      { id: "f2", name: "archive", createdAt: "2026-11-01T00:00:00Z" },
    ],
    ITEMS,
  );

  it("counts what is in each, leaving the Trash out", () => {
    expect(folders.map((folder) => folder.count)).toEqual([1, 0]);
    expect(projectCount(1)).toBe("1 project");
    expect(projectCount(6)).toBe("6 projects");
  });

  it("searches and sorts folders as the projects are", () => {
    expect(visibleFolders(folders, { search: "", sort: "recent" }).map((f) => f.id)).toEqual(["f2", "f1"]);
    expect(visibleFolders(folders, { search: "", sort: "oldest" }).map((f) => f.id)).toEqual(["f1", "f2"]);
    expect(visibleFolders(folders, { search: "", sort: "name" }).map((f) => f.id)).toEqual(["f2", "f1"]);
    expect(visibleFolders(folders, { search: "home", sort: "recent" }).map((f) => f.id)).toEqual(["f1"]);
  });
});
