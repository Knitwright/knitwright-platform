import { existsSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { FULL_WIDTH, frameFor } from "./frame";
import { showsHelpBubble } from "./help";
import { ACCOUNT_ITEMS, ADD_ITEMS, CREATE_ITEMS, WORKSPACE_ITEMS, helpHref, initialOf } from "./menus";
import { closeFor, openAtFor, startIndex } from "./menu-keys";
import { besideTrigger } from "./placement";
import { MOVED_PAGES, ROUTE_ALIASES } from "./redirects";
import { AI_STUDIO_TABS, ORDERS_TABS } from "./tabs";
import { UNKNOWN_WORKSPACE, loadWorkspace, workspaceOf } from "./workspace";

/** The shell's menus, keys, redirects, frames and workspace (decision 0138). */

const APP = new URL("../../app/(app)/", import.meta.url);

/** True when a page answers at this address: a folder under `app/(app)` holding a page.tsx. */
const hasPage = (address: string): boolean => {
  const folder = address.replace(/^\//, "").replace(/[?#].*$/, "").replace(/:(\w+)/g, "[$1]");
  const candidates = [new URL(`${folder}/page.tsx`, APP)];
  // Pages inside a route group, such as `studio/(home)`.
  for (const group of ["(home)", "(list)"]) candidates.push(new URL(`${folder}/${group}/page.tsx`, APP));
  // A page behind a dynamic segment, such as `ai-studio/workflow/[id]` (decision 0141).
  candidates.push(new URL(`${folder.replace(/\/[^/]+$/, "")}/[id]/page.tsx`, APP));
  return candidates.some((url) => existsSync(url));
};

describe("the Create menu", () => {
  it("lists 09 screen 1's items that have something behind them, and nothing else", () => {
    expect(CREATE_ITEMS.map((item) => item.label)).toEqual(["New kit design", "Kit from crest", "Social post", "Explore templates", "Blank canvas"]);
  });

  it("opens a page that exists for every entry of every menu", () => {
    for (const item of [...CREATE_ITEMS, ...ADD_ITEMS, ...ACCOUNT_ITEMS, ...WORKSPACE_ITEMS]) {
      expect(hasPage(item.href), item.href).toBe(true);
    }
  });
});

describe("the menu keys", () => {
  it("opens on the first entry with Enter, Space and ↓, on the last with ↑", () => {
    expect(openAtFor("Enter")).toBe("first");
    expect(openAtFor(" ")).toBe("first");
    expect(openAtFor("ArrowDown")).toBe("first");
    expect(openAtFor("ArrowUp")).toBe("last");
    expect(openAtFor("a")).toBeNull();
  });

  it("closes on Esc giving focus back, and on Tab letting it move on", () => {
    expect(closeFor("Escape")).toBe("refocus");
    expect(closeFor("Tab")).toBe("release");
    expect(closeFor("ArrowDown")).toBeNull();
  });

  it("starts on the first or the last of the entries, and on none when there are none", () => {
    expect(startIndex("first", 4)).toBe(0);
    expect(startIndex("last", 4)).toBe(3);
    expect(startIndex("first", 0)).toBeNull();
  });
});

describe("the small helpers", () => {
  it("takes an avatar's initial from a name or an address", () => {
    expect(initialOf("ana@example.test")).toBe("A");
    expect(initialOf("northfield FC")).toBe("N");
    expect(initialOf(null)).toBe("?");
    expect(initialOf("  ")).toBe("?");
  });

  it("writes Help as a message to the team", () => {
    expect(helpHref("hello@knitwright.com")).toBe("mailto:hello@knitwright.com?subject=Help%20with%20Knitwright");
  });

  it("keeps the help bubble off a canvas only", () => {
    expect(showsHelpBubble("/studio")).toBe(true);
    expect(showsHelpBubble("/studio/charts")).toBe(true);
    expect(showsHelpBubble("/launch")).toBe(true);
    expect(showsHelpBubble("/studio/0b5c3e4a-1111-4222-8333-944445555666")).toBe(false);
    expect(showsHelpBubble("/project/0b5c3e4a-1111-4222-8333-944445555666")).toBe(false);
    expect(showsHelpBubble("/launch/0b5c3e4a-1111-4222-8333-944445555666/history")).toBe(false);
  });

  it("gives the v3.9 pages the full width and keeps the v2.2 pages in their column", () => {
    expect(frameFor("/ai-studio/agent")).toBe("full");
    expect(frameFor("/orders")).toBe("full");
    expect(frameFor("/orders/runs")).toBe("column");
    expect(frameFor("/studio")).toBe("column");
    expect(FULL_WIDTH.every((prefix) => prefix.startsWith("/"))).toBe(true);
  });
});

describe("the redirects", () => {
  it("are temporary while a v2.2 page serves a v3.9 address, so a wave-2 page can take its address back", () => {
    const aliases = ROUTE_ALIASES.filter((alias) => !alias.permanent);
    for (const alias of aliases) expect(hasPage(alias.destination), alias.destination).toBe(true);
    expect(aliases.map((alias) => alias.source)).not.toContain("/team");
    expect(aliases.map((alias) => alias.source)).not.toContain("/brand");
  });

  it("are permanent for a page that moved for good: the club page, Collect and Brand Studio (decision 0144)", () => {
    expect(ROUTE_ALIASES).toContainEqual({ source: "/club", destination: "/team", permanent: true });
    expect(ROUTE_ALIASES).toContainEqual({ source: "/collect", destination: "/team?tab=approvals", permanent: true });
    expect(ROUTE_ALIASES).toContainEqual({ source: "/brand-studio", destination: "/brand", permanent: true });
    expect(ROUTE_ALIASES).toContainEqual({ source: "/brand-studio/import", destination: "/brand/import", permanent: true });
    expect(hasPage("/orders/runs")).toBe(true);
    expect(hasPage("/brand")).toBe(true);
    expect(hasPage("/team")).toBe(true);
  });

  it("each lands on a page that exists, from an address that has none", () => {
    for (const alias of ROUTE_ALIASES) {
      expect(hasPage(alias.destination), alias.destination).toBe(true);
      expect(hasPage(alias.source), alias.source).toBe(false);
    }
  });

  it("move a rebuilt page for good: /studio is Recent on Projects (decision 0139)", () => {
    expect(MOVED_PAGES).toContainEqual({ source: "/studio", destination: "/projects/recent", permanent: true });
    for (const moved of MOVED_PAGES) {
      expect(hasPage(moved.destination), moved.destination).toBe(true);
      expect(hasPage(moved.source), moved.source).toBe(false);
    }
    expect(ROUTE_ALIASES.map((alias) => alias.source)).not.toContain("/projects");
  });
});

describe("the area tabs", () => {
  it("open pages that exist", () => {
    for (const tab of [...AI_STUDIO_TABS, ...ORDERS_TABS]) expect(hasPage(tab.href), tab.href).toBe(true);
  });
});

describe("the workspace", () => {
  it("is a club by its welcome answer or its Brand Studio kind", () => {
    expect(workspaceOf({ organisationType: "club", kind: "brand", detailsDone: false })).toEqual({ isClub: true, setUp: false });
    expect(workspaceOf({ organisationType: "school", kind: "brand", detailsDone: true }).isClub).toBe(true);
    expect(workspaceOf({ organisationType: null, kind: "club", detailsDone: true }).isClub).toBe(true);
    expect(workspaceOf({ organisationType: "gym", kind: "brand", detailsDone: true })).toEqual({ isClub: false, setUp: true });
  });

  it("never stops a page: a failed read is reported and gives the neutral workspace", async () => {
    const report = vi.fn();
    const read = () => Promise.reject(new Error("down"));
    await expect(loadWorkspace(read, report)).resolves.toEqual(UNKNOWN_WORKSPACE);
    expect(report).toHaveBeenCalledOnce();
    const ok = () => Promise.resolve({ organisationType: "club", kind: "brand" as const, detailsDone: true });
    await expect(loadWorkspace(ok, report)).resolves.toEqual({ isClub: true, setUp: true });
  });
});

describe("where a rail menu opens", () => {
  it("sits 8 px right of its trigger, level with its top or, at the rail's foot, its bottom", () => {
    const trigger = { top: 84, right: 92, bottom: 128 };
    expect(besideTrigger(trigger, "start", 900)).toEqual({ left: 100, top: 84 });
    expect(besideTrigger(trigger, "end", 900)).toEqual({ left: 100, bottom: 772 });
  });

  it("never leaves the window, even for a trigger scrolled half out of it", () => {
    expect(besideTrigger({ top: -20, right: 92, bottom: 24 }, "start", 900).top).toBe(8);
    expect(besideTrigger({ top: 880, right: 92, bottom: 940 }, "end", 900).bottom).toBe(8);
  });
});
