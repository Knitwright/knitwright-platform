import { describe, expect, it } from "vitest";
import { ownUrl, readOwnPage, readPicture, PICTURE_TYPES } from "./fetch";
import { DEFAULT_IMPORT_SETTINGS } from "./settings";
import { HOST, SITE, fakeFetcher, navyAndGold, pageHtml, siteRoutes } from "./fixtures/site";
import { IMPORT_USER_AGENT } from "./words";

/**
 * The polite fetch. Every request here is answered from a fixture: `fakeFetcher` throws on an
 * address it was not given, so a test that would reach the network fails rather than making a call.
 */

const settings = DEFAULT_IMPORT_SETTINGS;
const now = (): Date => new Date("2026-11-02T09:00:00.000Z");

describe("ownUrl", () => {
  it("takes an https address of a public site", () => {
    const read = ownUrl(" https://ravensmoor.test/shop ");
    expect(read.ok && read.url.toString()).toBe(`${SITE}/shop`);
  });

  it.each([
    ["not a url at all", "ravensmoor", "bad_url"],
    ["a url with a password in it", "https://a:b@ravensmoor.test/", "bad_url"],
    ["an ftp address", "ftp://ravensmoor.test/", "bad_url"],
    ["http, because we read https only", "http://ravensmoor.test/", "not_https"],
    ["a machine on this network", "https://192.168.0.4/", "private_host"],
    ["localhost", "https://localhost/", "private_host"],
    ["a .internal name", "https://shop.internal/", "private_host"],
  ])("refuses %s, and says why", (_what, raw, reason) => {
    const read = ownUrl(raw);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.refusal.reason).toBe(reason);
    expect(!read.ok && read.refusal.message.length).toBeGreaterThan(30);
  });
});

describe("readOwnPage", () => {
  it("reads robots.txt and the page, and nothing else: two requests, no crawl", async () => {
    const fetcher = fakeFetcher(await siteRoutes());
    const read = await readOwnPage(fetcher, `${SITE}/`, settings, now);
    expect(read.ok).toBe(true);
    expect(fetcher.calls).toEqual([`${SITE}/robots.txt`, `${SITE}/`]);
  });

  it("says who we are, so a site owner can allow or refuse us", async () => {
    const fetcher = fakeFetcher(await siteRoutes());
    await readOwnPage(fetcher, `${SITE}/`, settings, now);
    expect(fetcher.agents).toEqual([IMPORT_USER_AGENT, IMPORT_USER_AGENT]);
  });

  it("gives back the page's words, its title and what it points at — and no markup", async () => {
    const read = await readOwnPage(fakeFetcher(await siteRoutes()), `${SITE}/`, settings, now);
    if (!read.ok) throw new Error("expected a page");
    expect(read.page.title).toBe("Ravensmoor Athletic — club shop");
    expect(read.page.host).toBe(HOST);
    expect(read.page.fetchedAt).toBe("2026-11-02T09:00:00.000Z");
    expect(read.page.links.cssColours).toContain("#0b1f4b");
    expect(JSON.stringify(read.page.links)).not.toMatch(/<[a-z!/]/i);
    expect(read.page.words).not.toMatch(/<[a-z!/]/i);
  });

  it("does not read a page its robots.txt refuses", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/robots.txt`] = { type: "text/plain", body: "User-agent: knitwrightbrandimport\nDisallow: /\n" };
    const fetcher = fakeFetcher(routes);
    const read = await readOwnPage(fetcher, `${SITE}/`, settings, now);
    expect(!read.ok && read.refusal.reason).toBe("robots");
    expect(fetcher.calls).toEqual([`${SITE}/robots.txt`]);
  });

  it("obeys a rule written for everybody, not only for us", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/robots.txt`] = { type: "text/plain", body: "User-agent: *\nDisallow: /\n" };
    const read = await readOwnPage(fakeFetcher(routes), `${SITE}/`, settings, now);
    expect(!read.ok && read.refusal.reason).toBe("robots");
  });

  it("refuses rather than guesses when robots.txt cannot be read at all", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/robots.txt`] = { status: 500 };
    const read = await readOwnPage(fakeFetcher(routes), `${SITE}/`, settings, now);
    expect(!read.ok && read.refusal.reason).toBe("robots");
  });

  it.each([
    ["a page that is not there", { status: 404 }, "unreachable"],
    ["a PDF, which is a file and not a page", { type: "application/pdf", body: "%PDF" }, "not_a_page"],
  ])("refuses %s", async (_what, reply, reason) => {
    const routes = await siteRoutes();
    routes[`${SITE}/`] = reply;
    const read = await readOwnPage(fakeFetcher(routes), `${SITE}/`, settings, now);
    expect(!read.ok && read.refusal.reason).toBe(reason);
  });

  it("refuses a page whose stated length is over the allowance, before reading it", async () => {
    const routes = await siteRoutes();
    const fetcher = fakeFetcher(routes);
    const big = (url: string, init: RequestInit): Promise<Response> =>
      url === `${SITE}/`
        ? Promise.resolve(new Response("x", { headers: { "content-type": "text/html", "content-length": "9000000" } }))
        : fetcher(url, init);
    const read = await readOwnPage(big, `${SITE}/`, settings, now);
    expect(!read.ok && read.refusal.reason).toBe("too_large");
  });

  it("says a site is unreachable when the request throws, and offers to try again", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/`] = new Error("socket closed");
    const read = await readOwnPage(fakeFetcher(routes), `${SITE}/`, settings, now);
    expect(!read.ok && read.refusal.reason).toBe("unreachable");
    expect(!read.ok && read.refusal.canRetry).toBe(true);
  });

  it("says a site is too slow when our own timeout stops it", async () => {
    const routes = await siteRoutes();
    const fetcher = fakeFetcher(routes);
    const slow = async (url: string, init: RequestInit): Promise<Response> => {
      if (url !== `${SITE}/`) return fetcher(url, init);
      await new Promise((resolve) => setTimeout(resolve, 30));
      init.signal?.throwIfAborted();
      return new Response("x", { headers: { "content-type": "text/html" } });
    };
    const read = await readOwnPage(slow, `${SITE}/`, { ...settings, timeoutMs: 5 }, now);
    expect(!read.ok && read.refusal.reason).toBe("too_slow");
  });

  it("refuses a bad address without making any request at all", async () => {
    const fetcher = fakeFetcher({});
    const read = await readOwnPage(fetcher, "http://ravensmoor.test/", settings, now);
    expect(!read.ok && read.refusal.reason).toBe("not_https");
    expect(fetcher.calls).toEqual([]);
  });

  it("cuts a page at the allowance rather than reading all of it", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/`] = { type: "text/html", body: `${pageHtml()}${"x".repeat(5000)}` };
    const read = await readOwnPage(fakeFetcher(routes), `${SITE}/`, { ...settings, pageBytes: 200 }, now);
    expect(read.ok && read.page.words.length).toBeLessThan(200);
  });
});

describe("readPicture", () => {
  it("reads one picture's bytes and its type", async () => {
    const read = await readPicture(fakeFetcher(await siteRoutes()), `${SITE}/media/logo.png`, settings);
    expect(read.ok && read.contentType).toBe("image/png");
    expect(read.ok && read.bytes.byteLength).toBeGreaterThan(50);
  });

  it("asks for no robots.txt of its own: the page's robots.txt already allowed this site", async () => {
    const fetcher = fakeFetcher(await siteRoutes());
    await readPicture(fetcher, `${SITE}/media/logo.png`, settings);
    expect(fetcher.calls).toEqual([`${SITE}/media/logo.png`]);
  });

  it("refuses anything that is not a picture", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/media/logo.png`] = { type: "text/html", body: "<html></html>" };
    const read = await readPicture(fakeFetcher(routes), `${SITE}/media/logo.png`, settings);
    expect(read.ok).toBe(false);
  });

  it("never asks for a font file, because no font type is one it takes", () => {
    expect(PICTURE_TYPES.some((type) => /font|woff|otf|ttf/i.test(type))).toBe(false);
  });

  it("refuses a picture over the allowance, by its stated length and by its bytes", async () => {
    const logo = await navyAndGold();
    const stated = fakeFetcher({
      [`${SITE}/big.png`]: { type: "image/png", body: logo },
    });
    const bytes = await readPicture(stated, `${SITE}/big.png`, { ...settings, pictureBytes: 10 });
    expect(!bytes.ok && bytes.refusal.reason).toBe("too_large");

    const headed = (): Promise<Response> =>
      Promise.resolve(new Response(logo, { headers: { "content-type": "image/png", "content-length": "9000000" } }));
    const byHeader = await readPicture(headed, `${SITE}/big.png`, settings);
    expect(!byHeader.ok && byHeader.refusal.reason).toBe("too_large");
  });

  it("refuses a picture on another site, however the page asked for it", async () => {
    const fetcher = fakeFetcher({});
    const read = await readPicture(fetcher, "http://ravensmoor.test/logo.png", settings);
    expect(!read.ok && read.refusal.reason).toBe("not_https");
    expect(fetcher.calls).toEqual([]);
  });

  it("says a picture is unreachable when the request throws", async () => {
    const read = await readPicture(fakeFetcher({ [`${SITE}/x.png`]: new Error("reset") }), `${SITE}/x.png`, settings);
    expect(!read.ok && read.refusal.reason).toBe("unreachable");
  });

  it("refuses a picture that is not there", async () => {
    const read = await readPicture(fakeFetcher({ [`${SITE}/x.png`]: { status: 404 } }), `${SITE}/x.png`, settings);
    expect(!read.ok && read.refusal.reason).toBe("unreachable");
  });
});
