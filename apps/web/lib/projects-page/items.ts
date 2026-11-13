import type { Route } from "next";

/**
 * The Projects page's list (09 screen 14, decision 0139). Studio designs and launch projects are
 * two tables until E1 unifies them, so the page lists both as one kind of card with a kind tag.
 * Everything here is pure: the page reads the rows, and these decide what is shown and in what order.
 */

export const PROJECT_KINDS = ["design", "launch"] as const;
export type ProjectKind = (typeof PROJECT_KINDS)[number];

export interface ProjectItem {
  readonly kind: ProjectKind;
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  /** How many boards a launch project holds. A design has no artboards of its own until E1. */
  readonly artboards: number | null;
  /** What it is: the garment of a design, or "Launch pack". */
  readonly detail: string;
  readonly folderId: string | null;
  /** When it was moved to the Trash, or null while it is not there. */
  readonly trashedAt: string | null;
}

export const KIND_LABELS: Readonly<Record<ProjectKind, string>> = {
  design: "Kit design",
  launch: "Launch pack",
};

export const isProjectKind = (value: unknown): value is ProjectKind => PROJECT_KINDS.some((kind) => kind === value);

/**
 * Where a card opens: the one canvas (decision 0145). `/project/<id>` takes a design's id, which
 * opens its home canvas, or a launch canvas's own id.
 */
export const itemHref = (item: Pick<ProjectItem, "kind" | "id">): Route => `/project/${item.id}` as Route;

export const SORTS = ["recent", "name", "oldest"] as const;
export type ProjectSort = (typeof SORTS)[number];

export const SORT_LABELS: Readonly<Record<ProjectSort, string>> = {
  recent: "Recent",
  name: "Name A to Z",
  oldest: "Oldest first",
};

type Query = string | readonly string[] | undefined;

const first = (value: Query): string | undefined => (Array.isArray(value) ? value[0] : (value as string | undefined));

/** The sort an address asks for. Anything else is "recent", so a mistyped address still lists. */
export const sortFromQuery = (value: Query): ProjectSort => SORTS.find((sort) => sort === first(value)) ?? "recent";

/** The most characters of a search that are used. */
export const SEARCH_LIMIT = 80;

/** The search an address asks for, trimmed and cut to the limit. */
export const searchFromQuery = (value: Query): string => (first(value) ?? "").trim().slice(0, SEARCH_LIMIT);

const byName = (a: ProjectItem, b: ProjectItem): number => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }) || a.id.localeCompare(b.id);
const byNewest = (a: ProjectItem, b: ProjectItem): number => b.updatedAt.localeCompare(a.updatedAt) || a.id.localeCompare(b.id);
const byOldest = (a: ProjectItem, b: ProjectItem): number => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

const byTrashed = (a: ProjectItem, b: ProjectItem): number => (b.trashedAt ?? "").localeCompare(a.trashedAt ?? "") || a.id.localeCompare(b.id);

const ORDER: Readonly<Record<ProjectSort, (a: ProjectItem, b: ProjectItem) => number>> = {
  recent: byNewest,
  name: byName,
  oldest: byOldest,
};

/** Whether an item's name or what it is contains the search, ignoring case. An empty search matches all. */
export const matches = (item: ProjectItem, search: string): boolean => {
  const needle = search.trim().toLocaleLowerCase("en-GB");
  if (needle === "") return true;
  return `${item.name} ${item.detail} ${KIND_LABELS[item.kind]}`.toLocaleLowerCase("en-GB").includes(needle);
};

export type ListView = Readonly<{
  search: string;
  sort: ProjectSort;
  /** Only the items in this folder; undefined for every folder. */
  folderId?: string;
  /** The Trash lists the trashed items, and every other view leaves them out. */
  trashed?: boolean;
}>;

/** The items one view shows, in its order. */
export const visibleItems = (items: readonly ProjectItem[], view: ListView): readonly ProjectItem[] =>
  items
    .filter((item) => (item.trashedAt !== null) === (view.trashed ?? false))
    .filter((item) => view.folderId === undefined || item.folderId === view.folderId)
    .filter((item) => matches(item, view.search))
    .toSorted(view.trashed && view.sort === "recent" ? byTrashed : ORDER[view.sort]);

export interface FolderSummary {
  readonly id: string;
  readonly name: string;
  readonly createdAt: string;
  readonly count: number;
}

/** Each folder with how many of the items are in it. Items in the Trash are not counted. */
export const folderCounts = (
  folders: readonly Omit<FolderSummary, "count">[],
  items: readonly ProjectItem[],
): readonly FolderSummary[] =>
  folders.map((folder) => ({
    ...folder,
    count: items.filter((item) => item.folderId === folder.id && item.trashedAt === null).length,
  }));

/** The folders one view shows: searched by name and sorted as the projects are. */
export const visibleFolders = (folders: readonly FolderSummary[], view: Pick<ListView, "search" | "sort">): readonly FolderSummary[] => {
  const needle = view.search.toLocaleLowerCase("en-GB");
  const found = folders.filter((folder) => folder.name.toLocaleLowerCase("en-GB").includes(needle));
  if (view.sort === "name") return found.toSorted((a, b) => a.name.localeCompare(b.name, "en-GB", { sensitivity: "base" }));
  return found.toSorted((a, b) => (view.sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : b.createdAt.localeCompare(a.createdAt)));
};

/** "Just now" becomes "just now"; "2 hours ago" and "4 Dec 2026" are kept as they are. */
const inSentence = (words: string): string => (/^[A-Z][a-z]/.test(words) ? `${words[0]!.toLowerCase()}${words.slice(1)}` : words);

/** The line under a card's name: what it is and when it last changed, or when it went to the Trash. */
export const cardLine = (item: ProjectItem, now: Date, when: (iso: string, now: Date) => string): string =>
  item.trashedAt !== null
    ? `${item.detail} · Moved to the Trash ${inSentence(when(item.trashedAt, now))}`
    : `${item.detail} · Edited ${inSentence(when(item.updatedAt, now))}`;

/** "1 project", "6 projects". */
export const projectCount = (count: number): string => (count === 1 ? "1 project" : `${count} projects`);
