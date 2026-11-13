import { describe, expect, it } from "vitest";
import { isMenuCommand, LAUNCH_HOME, launchHistoryPath, launchProjectPath, mainMenu, MENU_COMMANDS } from "./index";

describe("the main menu", () => {
  const menu = mainMenu("launch-1");

  it("is the spec's six items, in its order", () => {
    expect(menu.map((item) => item.label)).toEqual([
      "New project",
      "My projects",
      "Duplicate",
      "Settings…",
      "Save a version",
      "Version history",
    ]);
  });

  it("gives every page item a real address under the launch section", () => {
    for (const item of menu) {
      if (item.kind !== "page") continue;
      expect(item.href.startsWith(LAUNCH_HOME)).toBe(true);
    }
  });

  it("sends Version history to this project's own history page", () => {
    expect(menu.find((item) => item.id === "history")).toMatchObject({ href: "/launch/launch-1/history" });
  });

  it("lists only commands the shell handles, so nothing in the menu does nothing", () => {
    const commands = menu.filter((item) => item.kind === "command").map((item) => item.id);

    expect(commands).toEqual([...MENU_COMMANDS]);
    for (const id of commands) expect(isMenuCommand(id)).toBe(true);
    expect(isMenuCommand("publish")).toBe(false);
  });
});

describe("the addresses of a launch project", () => {
  it("escapes an id, so nothing in it can be read as part of the path", () => {
    expect(launchProjectPath("a/b")).toBe("/project/a%2Fb");
    expect(launchHistoryPath("a b")).toBe("/launch/a%20b/history");
  });
});
