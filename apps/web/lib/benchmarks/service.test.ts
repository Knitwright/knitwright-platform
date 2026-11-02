import { describe, expect, it, vi } from "vitest";
import { createStubExtractor } from "./extract";
import { BENCHMARK_USER_AGENT } from "./vocabulary";
import { card, fromPhoto, runningShort } from "./fixtures/cards";
import { createMemoryStore } from "./fixtures/memory-store";
import { BENCHMARK_LIMITS, TOO_MANY_FETCHES } from "./limits";
import { emptyCard } from "./schema";
import { urlKey } from "./fetch";
import { ALREADY_READ, addCardFromPhoto, addCardFromReviewText, addCardFromUrl, markCorrected, MAX_REVIEW_CHARS, type ServiceDeps } from "./service";

/**
 * Taking a benchmark in (spec F-S2 steps 1 to 4): one URL, fetched once, logged out, robots.txt honoured, within the
 * brand's own allowance; the page's words reach the extractor and nothing else; only the card is stored.
 */

const WHO = { brandId: "brand-1", userId: "user-1" };
const URL_IN = "https://shop.example.test/product/short?colour=black";

const page = (body: string, type = "text/html"): Response =>
  new Response(body, { status: 200, headers: { "content-type": type } });

type Call = Readonly<{ url: string; init: RequestInit }>;

/** A site whose robots.txt allows everything and whose product page is plain words. */
const siteOf = (robots = "User-agent: *\nAllow: /", html = "<h1>Speedshort</h1><p>88% polyester. &pound;45.00</p>") => {
  const calls: Call[] = [];
  const fetcher = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return url.endsWith("/robots.txt") ? page(robots, "text/plain") : page(html);
  });
  return { fetcher, calls };
};

const depsOf = (over: Partial<ServiceDeps> = {}): ServiceDeps & { store: ReturnType<typeof createMemoryStore> } => {
  const store = (over.store as ReturnType<typeof createMemoryStore> | undefined) ?? createMemoryStore();
  return {
    extractor: createStubExtractor([runningShort()]),
    fetcher: siteOf().fetcher,
    limiter: async () => true,
    ...over,
    store,
  };
};

const benchmarkIn = async (deps: ServiceDeps): Promise<string> => deps.store.create(WHO, { title: "Running shorts", projectId: null });

describe("a URL becomes a card", () => {
  it("fetches robots.txt and the page, in that order, and nothing else", async () => {
    const site = siteOf();
    const deps = depsOf({ fetcher: site.fetcher });
    const benchmarkId = await benchmarkIn(deps);

    const outcome = await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN });

    expect(outcome.ok).toBe(true);
    expect(site.calls.map((call) => call.url)).toEqual(["https://shop.example.test/robots.txt", URL_IN]);
  });

  it("sends the benchmark user agent, no cookies and no cache, on every request", async () => {
    const site = siteOf();
    const deps = depsOf({ fetcher: site.fetcher });

    await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    for (const call of site.calls) {
      expect((call.init.headers as Record<string, string>)["user-agent"]).toBe(BENCHMARK_USER_AGENT);
      expect(call.init.credentials).toBe("omit");
      expect(call.init.cache).toBe("no-store");
    }
  });

  it("stores the card, the source URL and the host, and no page source anywhere", async () => {
    const deps = depsOf();
    const benchmarkId = await benchmarkIn(deps);

    await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN });
    const held = await deps.store.read(WHO, benchmarkId);

    expect(held?.cards).toHaveLength(1);
    expect(held?.cards[0]).toMatchObject({ sourceKind: "url", sourceUrl: URL_IN, sourceHost: "shop.example.test" });
    expect(JSON.stringify(held)).not.toMatch(/[<>]|&pound;/);
  });

  it("hands the extractor the page's words and never its source", async () => {
    const extractor = createStubExtractor([runningShort()]);
    const deps = depsOf({ extractor });

    await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    expect(extractor.seen[0]?.words).toContain("88% polyester");
    expect(extractor.seen[0]?.words).not.toContain("<h1>");
  });

  it("reads a page once per brand: the second ask says so instead of fetching again", async () => {
    const site = siteOf();
    const deps = depsOf({ fetcher: site.fetcher });
    const benchmarkId = await benchmarkIn(deps);

    await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN });
    const again = await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN });

    expect(again).toEqual({ ok: false, reason: "already_read", message: ALREADY_READ });
    expect(site.fetcher).toHaveBeenCalledTimes(2);
  });

  it("counts the same page once however it is written, so a fragment cannot buy a second fetch", async () => {
    const deps = depsOf();
    const benchmarkId = await benchmarkIn(deps);

    await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN });
    const again = await addCardFromUrl(deps, WHO, { benchmarkId, url: `${URL_IN}#reviews` });

    expect(again).toMatchObject({ reason: "already_read" });
    expect([...deps.store.fetches.keys()]).toEqual([`brand-1:${urlKey(URL_IN)}`]);
  });

  it("does not fetch at all when the brand is over its allowance", async () => {
    const site = siteOf();
    const deps = depsOf({ fetcher: site.fetcher, limiter: async () => false });

    const outcome = await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    expect(outcome).toEqual({ ok: false, reason: "rate_limited", message: TOO_MANY_FETCHES });
    expect(site.fetcher).not.toHaveBeenCalled();
  });

  it("counts the brand's pages and the brand's pages from this site, both", async () => {
    const seen: string[] = [];
    const limiter = vi.fn(async (key: string) => {
      seen.push(key);
      return true;
    });
    const deps = depsOf({ limiter });

    await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    expect(seen).toEqual([`${BENCHMARK_LIMITS.brandFetch.name}:brand:brand-1`, `${BENCHMARK_LIMITS.hostFetch.name}:brand:brand-1:host:shop.example.test`]);
  });

  it("stops at a site's own robots.txt, says so plainly, and keeps that the page was never read", async () => {
    const site = siteOf("User-agent: knitwrightbenchmark\nDisallow: /product/");
    const extractor = createStubExtractor([runningShort()]);
    const deps = depsOf({ fetcher: site.fetcher, extractor });

    const outcome = await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    expect(outcome).toMatchObject({ ok: false, reason: "robots" });
    expect(site.calls.map((call) => call.url)).toEqual(["https://shop.example.test/robots.txt"]);
    expect(extractor.calls).toBe(0);
    expect([...deps.store.fetches.values()][0]?.outcome).toBe("robots_refused");
  });

  it("refuses an address that is not a public page, before anything is fetched", async () => {
    const site = siteOf();
    const deps = depsOf({ fetcher: site.fetcher });
    const benchmarkId = await benchmarkIn(deps);

    expect(await addCardFromUrl(deps, WHO, { benchmarkId, url: "not a url" })).toMatchObject({ reason: "bad_url" });
    expect(await addCardFromUrl(deps, WHO, { benchmarkId, url: "https://127.0.0.1/admin" })).toMatchObject({ reason: "private_host" });
    expect(site.fetcher).not.toHaveBeenCalled();
  });

  it("keeps that a fetch failed, so the page is not tried again and again", async () => {
    const fetcher = async (url: string) =>
      url.endsWith("/robots.txt") ? page("User-agent: *\nAllow: /", "text/plain") : new Response("", { status: 500 });
    const deps = depsOf({ fetcher });

    const outcome = await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    expect(outcome).toMatchObject({ reason: "unreachable" });
    expect([...deps.store.fetches.values()][0]?.outcome).toBe("failed");
  });

  it("lets a page that could not be reached be tried again: nothing was read the first time", async () => {
    let reachable = false;
    const fetcher = async (url: string) => {
      if (url.endsWith("/robots.txt")) return page("User-agent: *\nAllow: /", "text/plain");
      return reachable ? page("<p>88% polyester</p>") : new Response("", { status: 503 });
    };
    const deps = depsOf({ fetcher });
    const benchmarkId = await benchmarkIn(deps);

    expect(await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN })).toMatchObject({ reason: "unreachable" });
    reachable = true;

    expect(await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN })).toMatchObject({ ok: true });
  });

  it("does not let a page the site refused be tried again: the site said no", async () => {
    const site = siteOf("User-agent: *\nDisallow: /product/");
    const deps = depsOf({ fetcher: site.fetcher });
    const benchmarkId = await benchmarkIn(deps);

    expect(await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN })).toMatchObject({ reason: "robots" });
    expect(await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN })).toMatchObject({ reason: "already_read" });
  });

  it("treats a robots.txt it cannot read as a refusal: a polite fetcher does not guess", async () => {
    const deps = depsOf({ fetcher: async () => new Response("", { status: 500 }) });

    const outcome = await addCardFromUrl(deps, WHO, { benchmarkId: await benchmarkIn(deps), url: URL_IN });

    expect(outcome).toMatchObject({ reason: "robots" });
    expect([...deps.store.fetches.values()][0]?.outcome).toBe("robots_refused");
  });

  it("drops a complaint theme that copies the page's own words", async () => {
    const copied = card({ complaintThemes: [{ theme: "the liner rides up and the pocket bounces when you run downhill fast", count: 4 }] });
    const words = "Reviews: the liner rides up and the pocket bounces when you run downhill fast, say buyers.";
    const deps = depsOf({ extractor: createStubExtractor([copied]), fetcher: siteOf("User-agent: *\nAllow: /", words).fetcher });
    const benchmarkId = await benchmarkIn(deps);

    await addCardFromUrl(deps, WHO, { benchmarkId, url: URL_IN });

    expect((await deps.store.read(WHO, benchmarkId))?.cards[0]?.card.complaintThemes).toEqual([]);
  });
});

describe("a photo and pasted reviews", () => {
  it("reads the person's own photo and never fetches anything", async () => {
    const site = siteOf();
    const deps = depsOf({ extractor: createStubExtractor([fromPhoto()]), fetcher: site.fetcher });
    const benchmarkId = await benchmarkIn(deps);

    const outcome = await addCardFromPhoto(deps, WHO, { benchmarkId, fileId: "file-1", image: { mediaType: "image/png", base64: "AAAA" } });

    expect(outcome.ok).toBe(true);
    expect(site.fetcher).not.toHaveBeenCalled();
    expect((await deps.store.read(WHO, benchmarkId))?.cards[0]).toMatchObject({ sourceKind: "photo", sourceUrl: null });
  });

  it("keeps only the themes of pasted reviews, cut to what we read, and none of the words", async () => {
    const themed = card({ complaintThemes: [{ theme: "The liner rides up", count: 3 }] });
    const extractor = createStubExtractor([themed]);
    const deps = depsOf({ extractor });
    const benchmarkId = await benchmarkIn(deps);
    const pasted = `${"the stitching came apart after one wash. ".repeat(600)}`;

    await addCardFromReviewText(deps, WHO, { benchmarkId, text: pasted });
    const held = await deps.store.read(WHO, benchmarkId);

    expect(extractor.seen[0]?.words).toHaveLength(MAX_REVIEW_CHARS);
    expect(held?.cards[0]?.card.complaintThemes).toEqual([{ theme: "The liner rides up", count: 3 }]);
    expect(JSON.stringify(held)).not.toContain("the stitching came apart");
  });

  it("takes an empty card from a photo that shows nothing readable, rather than a guess", async () => {
    const deps = depsOf({ extractor: createStubExtractor([emptyCard()]) });
    const benchmarkId = await benchmarkIn(deps);

    await addCardFromPhoto(deps, WHO, { benchmarkId, fileId: "file-1", image: { mediaType: "image/png", base64: "AAAA" } });

    expect((await deps.store.read(WHO, benchmarkId))?.cards[0]?.card).toEqual(emptyCard());
  });
});

describe("markCorrected", () => {
  it("marks the fields a person changed as theirs and leaves the rest as they were", () => {
    const before = runningShort();
    const after = { ...before, fit: { value: "Regular", provenance: "observed" as const, corrected: false } };

    const marked = markCorrected(before, after);

    expect(marked.fit.corrected).toBe(true);
    expect(marked.productName.corrected).toBe(false);
  });

  it("keeps a field marked once it has been corrected, even when it is confirmed again unchanged", () => {
    const before = { ...runningShort(), fit: { value: "Regular", provenance: "observed" as const, corrected: true } };

    expect(markCorrected(before, before).fit.corrected).toBe(true);
  });
});
