import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { Workspace } from "@/lib/shell/nav";
import { RailView } from "./Rail";
import { TopBarView } from "./TopBar";

/**
 * The shell's markup (decision 0138): what the rail marks as current, what it shows a club, and that
 * every menu is a closed menu button until it is pressed. The keys themselves are tested in
 * `lib/shell/menu-keys` and in the browser by `e2e/shell.spec.ts`.
 */

const BRAND: Workspace = { isClub: false, setUp: true };
const CLUB: Workspace = { isClub: true, setUp: false };
const HELP = "mailto:hello@knitwright.com";

const rail = (path: string, workspace: Workspace = BRAND): string =>
  renderToStaticMarkup(h(RailView, { path, workspace, brandName: "Northfield FC", helpHref: HELP }));

const bar = (path: string, workspace: Workspace = BRAND, email: string | null = "ana@example.test"): string =>
  renderToStaticMarkup(h(TopBarView, { path, workspace, brandName: "Northfield FC", email, credits: 120, helpHref: HELP }));

const currentLinks = (html: string): string[] => [...html.matchAll(/<a [^>]*aria-current="page"[^>]*data-rail="([^"]+)"/g)].map((match) => match[1]!);

describe("the rail", () => {
  it("is the main navigation, with Create and every rail place", () => {
    const html = rail("/templates");
    expect(html).toMatch(/<nav aria-label="Main"/);
    for (const label of ["Create", "AI Studio", "Templates", "Mockups", "Marketing", "Products", "Projects", "Help"]) {
      expect(html).toContain(`>${label}</span>`);
    }
  });

  it("marks exactly one place current, the one the address is in", () => {
    expect(currentLinks(rail("/templates"))).toEqual(["templates"]);
    expect(currentLinks(rail("/products/JSY-SS-01"))).toEqual(["products"]);
    expect(currentLinks(rail("/settings"))).toEqual([]);
  });

  it("gives the current place the grey square and its label the weight", () => {
    const html = rail("/studio");
    expect(html).toMatch(/data-rail="projects" href="\/studio"><span class="[^"]*bg-soft-2/);
  });

  it("keeps Orders and Store behind ⌄ until it is opened, and opens it for a page inside", () => {
    const closed = rail("/studio");
    expect(closed).toMatch(/aria-expanded="false"[^>]*aria-label="Orders, Store and more"/);
    expect(closed).toMatch(/<div id="[^"]+" hidden="" [^>]*>.*data-rail="orders"/);
    const open = rail("/orders/runs");
    expect(open).toMatch(/aria-expanded="true"[^>]*aria-label="Fewer places"/);
    expect(currentLinks(open)).toEqual(["orders"]);
  });

  it("shows Team to a club only", () => {
    expect(rail("/studio", CLUB)).toContain('data-rail="team"');
    expect(rail("/studio", BRAND)).not.toContain('data-rail="team"');
  });

  it("is not drawn on a canvas, which has its own chrome", () => {
    expect(rail("/studio/0b5c3e4a-1111-4222-8333-944445555666")).toBe("");
    expect(bar("/studio/0b5c3e4a-1111-4222-8333-944445555666")).toMatch(/<div class="relative"><button[^>]*aria-label="Menu"/);
  });

  it("names the current page on ⋯ when it is one of its own", () => {
    expect(rail("/teamwear")).toContain('aria-label="More, current: Teamwear"');
    expect(rail("/studio")).toContain('aria-label="More"');
  });

  it("draws every menu as a closed menu button that names no panel yet", () => {
    const html = rail("/studio");
    const buttons = [...html.matchAll(/<button[^>]*aria-haspopup="menu"[^>]*>/g)].map((match) => match[0]);
    expect(buttons.length).toBe(3);
    for (const button of buttons) {
      expect(button).toContain('aria-expanded="false"');
      expect(button).not.toContain("aria-controls");
    }
  });
});

describe("the top bar", () => {
  it("carries the brand pill, ⊕, Upgrade and the account avatar", () => {
    const html = bar("/studio");
    expect(html).toContain("Brand: Northfield FC. Open Brand Studio.");
    expect(html).toContain('aria-label="Invite or add credits"');
    expect(html).toMatch(/href="\/credits"[^>]*>.*Upgrade<\/a>/);
    expect(html).toContain('aria-label="Account"');
  });

  it("shows the gold New until the brand is set up", () => {
    expect(bar("/studio", CLUB)).toContain('data-testid="brand-new"');
    expect(bar("/studio", CLUB)).toContain("New, not set up yet.");
    expect(bar("/studio", BRAND)).not.toContain('data-testid="brand-new"');
  });

  it("marks the brand pill current on Brand Studio", () => {
    expect(bar("/brand-studio")).toMatch(/<a [^>]*aria-current="page"[^>]*href="\/brand-studio"|<a [^>]*href="\/brand-studio"[^>]*aria-current="page"/);
    expect(bar("/studio")).not.toContain('aria-current="page"');
  });

  it("leaves the centre to the page, and the avatar its initial", () => {
    expect(bar("/studio")).toContain('id="shell-top-slot"');
    expect(bar("/studio")).toMatch(/aria-label="Account"[^>]*>A<\/button>/);
    expect(bar("/studio", BRAND, null)).toMatch(/aria-label="Account"[^>]*>\?<\/button>/);
  });

  it("starts with the phone Menu, hidden from md up", () => {
    expect(bar("/studio")).toMatch(/<div class="relative md:hidden"><button[^>]*aria-label="Menu"/);
  });
});
