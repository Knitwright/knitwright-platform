import type { Route } from "next";

/**
 * The Projects page's addresses (09 screen 14, decision 0139), as the prototype names them: the
 * top tabs Recent, Projects and AI Creations, and under Projects the sub-tabs Projects, Folders,
 * Shared and Trash. `/studio`, the v2.2 studio home, now redirects to Recent.
 */

export const PROJECTS_PATH = "/projects";
export const RECENT_PATH = "/projects/recent";
export const AI_PATH = "/projects/ai";
export const FOLDERS_PATH = "/projects/folders";
export const SHARED_PATH = "/projects/shared";
export const TRASH_PATH = "/projects/trash";

export const folderPath = (folderId: string): Route => `${FOLDERS_PATH}/${folderId}` as Route;

export interface ProjectsTab {
  readonly href: Route;
  readonly label: string;
  readonly owns?: readonly string[];
}

/** The top bar's tabs. The most specific tab wins, so Projects is not current on Recent. */
export const PROJECTS_TABS: readonly ProjectsTab[] = [
  { href: RECENT_PATH as Route, label: "Recent" },
  { href: PROJECTS_PATH as Route, label: "Projects" },
  { href: AI_PATH as Route, label: "AI Creations" },
];

export type SubTabId = "projects" | "folders" | "shared" | "trash";

export interface SubTab {
  readonly id: SubTabId;
  readonly href: Route;
  readonly label: string;
}

export const SUB_TABS: readonly SubTab[] = [
  { id: "projects", href: PROJECTS_PATH as Route, label: "Projects" },
  { id: "folders", href: FOLDERS_PATH as Route, label: "Folders" },
  { id: "shared", href: SHARED_PATH as Route, label: "Shared" },
  { id: "trash", href: TRASH_PATH as Route, label: "Trash" },
];

/** Every path the page's changes can alter, so each is read again after one. */
export const PATHS_TO_REFRESH: readonly string[] = [PROJECTS_PATH, RECENT_PATH, FOLDERS_PATH, TRASH_PATH, "/launch"];

/** An address with the view's sort and search kept, leaving out what is the default. */
export const viewHref = (path: string, view: Readonly<{ sort?: string; search?: string }>): Route => {
  const query = new URLSearchParams();
  if (view.sort && view.sort !== "recent") query.set("sort", view.sort);
  if (view.search) query.set("q", view.search);
  const text = query.toString();
  return (text ? `${path}?${text}` : path) as Route;
};
