import { describe, expect, it } from "vitest";
import { fetchProductPage, normaliseUrl, urlKey, wordsOfPage, type Fetcher } from "./fetch";
import { BENCHMARK_USER_AGENT } from "./vocabulary";

/**
 * One fetch of one page (spec F-S2 step 2): logged out, our own user agent, robots.txt honoured, nothing followed off
 * the page, and nothing of the page's source coming back.
 */

const PAGE = [
  "<!doctype html><html><head><title>Speedshort 5in | Acme</title>",
  '<meta property="og:description" content="88% polyester, 12% elastane. 140 g/m2.">',
  "<style>.price{color:red}</style><script>window.price=4500</script></head>",
  "<body><h1>Speedshort 5in</h1><p>&pound;45.00</p><!-- a comment --><p>Zip back pocket</p></body></html>",
].join("");

type Call = Readonly<{ url: string; init: RequestInit }>;

const fetcherFor = (replies: Readonly<Record<string, Response>>, calls: Call[] = []): Fetcher => {
  const fetcher: Fetcher = async (url, init) => {
    calls.push({ url, init });
    const reply = replies[url];
    if (reply === undefined) throw new Error(`nothing is served at ${url}`);
    return reply;
  };
  return fetcher;
};

const html = (body = PAGE, type = "text/html; charset=utf-8", headers: Record<string, string> = {}) =>
  new Response(body, { status: 200, headers: { "content-type": type, ...headers } });

const robots = (body: string) => new Response(body, { status: 200, headers: { "content-type": "text/plain" } });

describe("the fetch itself", () => {
  it("asks for robots.txt and then the page, and nothing else", async () => {
    const calls: Call[] = [];
    const outcome = await fetchProductPage(
      fetcherFor({ "https://shop.test/robots.txt": robots("User-agent: *\nDisallow: /checkout"), "https://shop.test/p/1": html() }, calls),
      "https://shop.test/p/1",
    );
    expect(outcome.ok).toBe(true);
    expect(calls.map((call) => call.url)).toEqual(["https://shop.test/robots.txt", "https://shop.test/p/1"]);
  });

  it("sends our own user agent, sends no cookies and keeps nothing in a cache", async () => {
    const calls: Call[] = [];
    await fetchProductPage(fetcherFor({ "https://shop.test/robots.txt": robots(""), "https://shop.test/p/1": html() }, calls), "https://shop.test/p/1");
    for (const call of calls) {
      expect((call.init.headers as Record<string, string>)["user-agent"]).toBe(BENCHMARK_USER_AGENT);
      expect(call.init.credentials).toBe("omit");
      expect(call.init.cache).toBe("no-store");
      expect(JSON.stringify(call.init.headers)).not.toContain("cookie");
    }
  });

  it("brings back the page's words and never its source", async () => {
    const outcome = await fetchProductPage(
      fetcherFor({ "https://shop.test/robots.txt": robots(""), "https://shop.test/p/1": html() }),
      "https://shop.test/p/1",
      () => new Date("2026-11-20T10:00:00Z"),
    );
    if (!outcome.ok) throw new Error(outcome.message);
    expect(outcome.page).toEqual({
      url: "https://shop.test/p/1",
      host: "shop.test",
      title: "Speedshort 5in | Acme",
      words: expect.stringContaining("Zip back pocket"),
      fetchedAt: "2026-11-20T10:00:00.000Z",
    });
    expect(outcome.page.words).not.toContain("<");
    expect(outcome.page.words).not.toContain("window.price");
    expect(JSON.stringify(outcome)).not.toContain("doctype");
  });
});

describe("robots.txt decides", () => {
  it("does not fetch a page the site asks us not to read", async () => {
    const calls: Call[] = [];
    const outcome = await fetchProductPage(
      fetcherFor({ "https://shop.test/robots.txt": robots("User-agent: KnitwrightBenchmark\nDisallow: /p/") }, calls),
      "https://shop.test/p/1",
    );
    expect(outcome).toMatchObject({ ok: false, reason: "robots" });
    expect(calls.map((call) => call.url)).toEqual(["https://shop.test/robots.txt"]);
  });

  it("refuses when robots.txt cannot be read at all, rather than guessing", async () => {
    const broken = await fetchProductPage(fetcherFor({ "https://shop.test/robots.txt": new Response("", { status: 500 }) }), "https://shop.test/p/1");
    expect(broken).toMatchObject({ ok: false, reason: "robots" });
    const missing: Fetcher = async (url, init) =>
      url.endsWith("/robots.txt") ? Promise.reject(new Error("network")) : fetcherFor({ "https://shop.test/p/1": html() })(url, init);
    expect(await fetchProductPage(missing, "https://shop.test/p/1")).toMatchObject({ ok: false, reason: "robots" });
  });

  it("reads the page when the site has no robots.txt", async () => {
    const outcome = await fetchProductPage(
      fetcherFor({ "https://shop.test/robots.txt": new Response("", { status: 404 }), "https://shop.test/p/1": html() }),
      "https://shop.test/p/1",
    );
    expect(outcome.ok).toBe(true);
  });
});

describe("what it will not fetch", () => {
  it("refuses an address that is not a public web page, without any request at all", async () => {
    const calls: Call[] = [];
    const fetcher = fetcherFor({}, calls);
    expect(await fetchProductPage(fetcher, "not a url")).toMatchObject({ ok: false, reason: "bad_url" });
    expect(await fetchProductPage(fetcher, "ftp://shop.test/p")).toMatchObject({ ok: false, reason: "bad_url" });
    expect(await fetchProductPage(fetcher, "http://127.0.0.1:8000/p")).toMatchObject({ ok: false, reason: "private_host" });
    expect(await fetchProductPage(fetcher, "http://10.1.2.3/p")).toMatchObject({ ok: false, reason: "private_host" });
    expect(await fetchProductPage(fetcher, "http://db.internal/p")).toMatchObject({ ok: false, reason: "private_host" });
    expect(calls).toEqual([]);
  });

  it("refuses a page that is not a page, one that is too big, and one that is not there", async () => {
    // A fresh robots.txt each time: a Response's body may be read once.
    const served = (page: Response) => fetcherFor({ "https://shop.test/robots.txt": robots(""), "https://shop.test/p/1": page });
    expect(await fetchProductPage(served(html("{}", "application/json")), "https://shop.test/p/1")).toMatchObject({ ok: false, reason: "not_a_page" });
    expect(await fetchProductPage(served(html(PAGE, "text/html", { "content-length": "9000000" })), "https://shop.test/p/1")).toMatchObject({
      ok: false,
      reason: "too_large",
    });
    expect(await fetchProductPage(served(new Response("", { status: 404 })), "https://shop.test/p/1")).toMatchObject({ ok: false, reason: "unreachable" });
  });
});

describe("the URL itself", () => {
  it("drops the fragment, refuses credentials in the address, and keys the same page once", () => {
    expect(normaliseUrl("https://shop.test/p/1#reviews")?.toString()).toBe("https://shop.test/p/1");
    expect(normaliseUrl("https://user:pass@shop.test/p/1")).toBeNull();
    expect(normaliseUrl("  https://shop.test/p/1  ")?.toString()).toBe("https://shop.test/p/1");
    expect(urlKey("https://shop.test/p/1#reviews")).toBe(urlKey("https://shop.test/p/1"));
    expect(urlKey("https://shop.test/p/1")).not.toBe(urlKey("https://shop.test/p/2"));
    expect(urlKey("not a url")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("the words of a page", () => {
  it("keeps the description meta and drops scripts, styles and comments", () => {
    const read = wordsOfPage(PAGE);
    expect(read.title).toBe("Speedshort 5in | Acme");
    expect(read.words).toContain("88% polyester");
    expect(read.words).not.toContain("color:red");
    expect(read.words).not.toContain("a comment");
  });

  it("has no title where the page has none", () => {
    expect(wordsOfPage("<html><body>Plain</body></html>").title).toBeNull();
    expect(wordsOfPage("<html><head><title> </title></head><body>Plain</body></html>").title).toBeNull();
  });
});
