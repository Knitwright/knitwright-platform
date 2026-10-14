import { describe, expect, it } from "vitest";
import { opensAnotherPage, type LinkClick } from "./progress";

const HERE = "https://app.knitwright.com/studio/abc";

const click = (href: string, overrides: Partial<LinkClick> = {}): LinkClick => ({
  href,
  current: HERE,
  button: 0,
  modified: false,
  target: "",
  download: false,
  ...overrides,
});

describe("opensAnotherPage", () => {
  it("is true for a plain click on a link to another page of the app", () => {
    expect(opensAnotherPage(click("https://app.knitwright.com/settings"))).toBe(true);
    expect(opensAnotherPage(click("https://app.knitwright.com/studio/abc/tech-pack"))).toBe(true);
  });

  it("is false for the same page with another query or hash, which shows no new page", () => {
    expect(opensAnotherPage(click("https://app.knitwright.com/studio/abc?colourway=2"))).toBe(false);
    expect(opensAnotherPage(click("https://app.knitwright.com/studio/abc#sizes"))).toBe(false);
  });

  it("is false for another site", () => {
    expect(opensAnotherPage(click("https://example.com/settings"))).toBe(false);
  });

  it("is false when the browser handles the click: a new tab, a download, another button or a modifier key", () => {
    expect(opensAnotherPage(click("https://app.knitwright.com/settings", { target: "_blank" }))).toBe(false);
    expect(opensAnotherPage(click("https://app.knitwright.com/settings", { download: true }))).toBe(false);
    expect(opensAnotherPage(click("https://app.knitwright.com/settings", { button: 1 }))).toBe(false);
    expect(opensAnotherPage(click("https://app.knitwright.com/settings", { modified: true }))).toBe(false);
  });

  it("is true for a link that targets this window by name", () => {
    expect(opensAnotherPage(click("https://app.knitwright.com/settings", { target: "_self" }))).toBe(true);
  });

  it("is false for an address that cannot be read", () => {
    expect(opensAnotherPage(click("http://[bad"))).toBe(false);
  });
});
