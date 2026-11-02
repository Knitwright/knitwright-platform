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

describe("the shapes markup comes in", () => {
  const page = `${SITE}/`;

  it("reads an attribute written with single quotes and one written bare", () => {
    const single = linksOfPage(`<img src='/media/a.png' alt='Kit' />`, page);
    expect(single.pictures[0]).toMatchObject({ url: `${SITE}/media/a.png`, alt: "Kit" });
    const bare = linksOfPage(`<img src=/media/b.png alt=Kit>`, page);
    expect(bare.pictures[0]?.url).toBe(`${SITE}/media/b.png`);
  });

  it("reads a manifest icon as an icon of the site", () => {
    const links = linksOfPage(`<link rel="manifest" href="/site.webmanifest" />`, page);
    expect(links.icons[0]).toMatchObject({ why: "manifest-icon", url: `${SITE}/site.webmanifest` });
  });

  it("takes a link's title as what the page called the icon", () => {
    expect(linksOfPage(`<link rel="icon" href="/f.png" title="Club mark" />`, page).icons[0]?.alt).toBe("Club mark");
  });

  it("leaves out an img with no address at all, and an empty srcset", () => {
    expect(linksOfPage(`<img alt="Kit" /><img srcset="" alt="Kit" />`, page).pictures).toEqual([]);
  });

  it("falls back to the favicon when a link has a rel we do not read, or no href", () => {
    expect(linksOfPage(`<link rel="stylesheet" href="/a.css" /><link rel="icon" />`, page).icons[0]?.url).toBe(`${SITE}/favicon.ico`);
  });

  it("reads a style block with nothing in it, and a theme colour with no content", () => {
    expect(coloursOfStyles(stylesOf(`<style></style><meta name="theme-color" />`))).toEqual([]);
  });

  it("reads a family from a web-font address written as an escape", () => {
    expect(fontsOfPage(`<link rel="stylesheet" href="https://use.typekit.net/css2?family=Ravensmoor%20Grotesk" />`, "")).toEqual(["Ravensmoor Grotesk"]);
  });

  it("leaves out a family name too long to be one, and a rule with nothing after the colon", () => {
    expect(fontsOfPage("", `a{font-family:"${"x".repeat(80)}"}`)).toEqual([]);
    expect(fontsOfPage("", "a{font-family:  }")).toEqual([]);
  });

  it("holds one picture once, however many times the page names it", () => {
    expect(linksOfPage(`<img src="/media/a.png" alt="Kit" /><img src="/media/a.png" alt="Kit" />`, page).pictures).toHaveLength(1);
  });

  it("reads an img that says nothing about itself as a product photo", () => {
    expect(linksOfPage(`<img src="/media/a.png">`, page).pictures[0]).toMatchObject({ why: "img-product", alt: null });
  });

  it("leaves out an img on another site, even one the page calls a logo", () => {
    expect(linksOfPage(`<img src="https://other.test/logo.png" alt="Their logo" />`, page)).toMatchObject({ logos: [], pictures: [] });
  });

  it("leaves out a link with no rel, and an icon or a social picture on another site", () => {
    const links = linksOfPage(
      `<link href="/x.png" /><link rel="icon" href="https://other.test/f.png" /><meta property="og:image" content="https://other.test/hero.png" /><meta property="og:image" />`,
      page,
    );
    expect(links.icons.map((one) => one.url)).toEqual([`${SITE}/favicon.ico`]);
    expect(links.pictures).toEqual([]);
  });

  it("reads a page with no styles and no pictures as pointing at nothing but its favicon", () => {
    const bare = linksOfPage("<html><body></body></html>", page);
    expect(bare).toMatchObject({ logos: [], pictures: [], cssColours: [], fontFamilies: [] });
    expect(bare.icons).toHaveLength(1);
  });
});
