import { describe, expect, it } from "vitest";
import { coloursOfStyles, fontsOfPage, linksOfPage, ownAddress, sameSite, siteOf, stylesOf } from "./discover";
import { SITE, pageHtml } from "./fixtures/site";

/** Reading one page's markup. The fixtures are written in `fixtures/site.ts`: no real site is committed. */

describe("ownAddress", () => {
  const page = new URL(`${SITE}/shop`);

  it("makes a relative address absolute on the page's own site", () => {
    expect(ownAddress("/media/logo.png", page)?.toString()).toBe(`${SITE}/media/logo.png`);
  });

  it("takes a subdomain of the same site", () => {
    expect(ownAddress("https://cdn.ravensmoor.test/logo.png", page)?.toString()).toBe("https://cdn.ravensmoor.test/logo.png");
  });

  it.each([
    ["another site", "https://other.test/logo.png"],
    ["http, because we read https only", "http://ravensmoor.test/logo.png"],
    ["a data url, which is a picture in the markup", "data:image/png;base64,AAAA"],
    ["nothing at all", "   "],
    ["an address that is not one", "https://"],
  ])("refuses %s", (_what, raw) => {
    expect(ownAddress(raw, page)).toBeNull();
  });

  it("drops the fragment, so one picture is not two", () => {
    expect(ownAddress("/logo.png#top", page)?.toString()).toBe(`${SITE}/logo.png`);
  });
});

describe("sameSite", () => {
  it("knows a site, its subdomains and nothing else", () => {
    expect(sameSite("ravensmoor.test", "www.ravensmoor.test")).toBe(true);
    expect(sameSite("ravensmoor.test", "other.test")).toBe(false);
  });

  it("takes Instagram's own picture network as the brand's own pictures, because F-S9 names Instagram", () => {
    expect(sameSite("instagram.com", "scontent-lhr8-1.cdninstagram.com")).toBe(true);
    expect(sameSite("instagram.com", "pinterest.com")).toBe(false);
  });

  it("reads the last two labels of a host as its site", () => {
    expect(siteOf("WWW.Ravensmoor.TEST")).toBe("ravensmoor.test");
  });
});

describe("coloursOfStyles", () => {
  it("reads #abc, #aabbcc and rgb() as one list of #rrggbb, in the order first met", () => {
    expect(coloursOfStyles("a{color:#ABC} b{color:#0b1f4b} c{background:rgb(255, 209, 0)}")).toEqual(["#0b1f4b", "#aabbcc", "#ffd100"]);
  });

  it("holds a colour once, however many times the page says it", () => {
    expect(coloursOfStyles("a{color:#0b1f4b} b{color:#0b1f4b}")).toEqual(["#0b1f4b"]);
  });

  it("keeps an out-of-range rgb() inside a byte rather than inventing a value", () => {
    expect(coloursOfStyles("a{color:rgb(999,0,0)}")).toEqual(["#ff0000"]);
  });
});

describe("stylesOf", () => {
  it("reads style blocks, inline style attributes and the theme colour, and nothing else", () => {
    const styles = stylesOf(pageHtml());
    expect(styles).toContain("--brand: #0b1f4b");
    expect(styles).toContain("#2f6f4f");
    expect(styles).toContain("#0b1f4b");
  });
});

describe("fontsOfPage", () => {
  const html = pageHtml();

  it("reads the families a web-font stylesheet names and the ones the page's own rules name", () => {
    expect(fontsOfPage(html, stylesOf(html))).toEqual(["Bebas Neue", "Source Serif 4"]);
  });

  it("leaves out the generics a page did not choose", () => {
    expect(fontsOfPage("", "a{font-family: Georgia, serif, system-ui, -apple-system}")).toEqual([]);
  });

  it("leaves a family name as the page wrote it, trimmed of quotes", () => {
    expect(fontsOfPage("", `a{font-family: 'Ravensmoor Grotesk'}`)).toEqual(["Ravensmoor Grotesk"]);
  });
});

describe("linksOfPage", () => {
  const links = linksOfPage(pageHtml(), `${SITE}/`);

  it("finds the favicon and the touch icon", () => {
    expect(links.icons.map((one) => one.why)).toEqual(["favicon", "apple-touch-icon"]);
    expect(links.icons[0]?.url).toBe(`${SITE}/favicon.png`);
  });

  it("tells a mark from a product photo by what the page calls it", () => {
    expect(links.logos.map((one) => one.url)).toEqual([`${SITE}/media/logo.png`]);
    expect(links.pictures.map((one) => one.url)).toContain(`${SITE}/media/shirt-1.png`);
  });

  it("puts the social picture first among the photos, because it is the brand's own best", () => {
    expect(links.pictures[0]?.why).toBe("og-image");
  });

  it("leaves out a tracking pixel, a spacer and anything on another site", () => {
    const addresses = [...links.icons, ...links.logos, ...links.pictures].map((one) => one.url);
    expect(addresses.some((url) => url.includes("tracker.test"))).toBe(false);
    expect(addresses.some((url) => url.includes("spacer"))).toBe(false);
  });

  it("returns addresses, colours and family names, and never a tag", () => {
    const everything = JSON.stringify(links);
    expect(everything).not.toMatch(/<[a-z!/]/i);
    expect(links.cssColours.every((hex) => /^#[0-9a-f]{6}$/.test(hex))).toBe(true);
  });

  it("falls back to /favicon.ico when the page points at no icon at all", () => {
    const bare = linksOfPage("<html><head><title>x</title></head><body></body></html>", `${SITE}/`);
    expect(bare.icons.map((one) => one.url)).toEqual([`${SITE}/favicon.ico`]);
  });

  it("reads the alt text as the picture's name, and a data-src as its address", () => {
    const html = `<img data-src="/media/kit.png" alt="Away kit 2026" />`;
    const found = linksOfPage(html, `${SITE}/`).pictures;
    expect(found[0]).toMatchObject({ url: `${SITE}/media/kit.png`, alt: "Away kit 2026", why: "img-product" });
  });

  it("reads the first address of a srcset, which is the one the page offers first", () => {
    const html = `<img srcset="/media/a.png 1x, /media/b.png 2x" alt="Kit" />`;
    expect(linksOfPage(html, `${SITE}/`).pictures[0]?.url).toBe(`${SITE}/media/a.png`);
  });
});
