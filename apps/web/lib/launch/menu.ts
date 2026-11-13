/**
 * The main menu of the launch shell (spec Launch shell, "Main menu (≡)"): New project, My
 * projects, Duplicate, Settings (units, including millimetres), Save and Version history.
 *
 * Every item goes somewhere that exists: a page of this workstream, or a command the shell itself
 * carries out. Nothing is listed that does nothing, as the editor's File menu already holds
 * (`lib/editor/file-menu.ts`).
 */

export type MenuItem =
  /** A link to a page. Real, so it also opens in a new tab. */
  | Readonly<{ kind: "page"; id: string; label: string; href: string }>
  /** Something the shell does in place: saving a version, duplicating, opening the settings panel. */
  | Readonly<{ kind: "command"; id: string; label: string }>;

export const LAUNCH_HOME = "/launch";

/** A canvas opens on the one canvas (decision 0145); its history and its delete stay under `/launch`. */
export const launchProjectPath = (projectId: string): string => `/project/${encodeURIComponent(projectId)}`;

export const launchHistoryPath = (projectId: string): string => `${LAUNCH_HOME}/${encodeURIComponent(projectId)}/history`;

/** The menu for one launch project, in the order a person reaches for it. */
export function mainMenu(projectId: string): readonly MenuItem[] {
  return [
    { kind: "page", id: "new", label: "New project", href: `${LAUNCH_HOME}?new=1` },
    { kind: "page", id: "projects", label: "My projects", href: LAUNCH_HOME },
    { kind: "command", id: "duplicate", label: "Duplicate" },
    { kind: "command", id: "settings", label: "Settings…" },
    { kind: "command", id: "save", label: "Save a version" },
    { kind: "page", id: "history", label: "Version history", href: launchHistoryPath(projectId) },
  ];
}

/** The commands the menu can ask for, so the shell handles every one of them and no more. */
export const MENU_COMMANDS = ["duplicate", "settings", "save"] as const;
export type MenuCommand = (typeof MENU_COMMANDS)[number];

export const isMenuCommand = (id: string): id is MenuCommand => (MENU_COMMANDS as readonly string[]).includes(id);
