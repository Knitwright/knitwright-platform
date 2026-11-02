import { describe, expect, it } from "vitest";
import { runImport, type ImportDeps } from "./run";
import { DEFAULT_IMPORT_SETTINGS } from "./settings";
import { createScriptedStyleWriter, createStubStyleWriter } from "./style";
import { allows, fakeFetcher, kitFonts, refuses, siteRoutes, SITE } from "./fixtures/site";
import { IMPORT_STAGES } from "./words";
import type { StageReport } from "./types";

/**
 * One whole import, against local fixtures only. Nothing here writes: `runImport` has no database
 * client and no storage client, and the proposal it returns is a plain object every item of which
 * is still pending.
 */

const who = { brandId: "b1", userId: "u1" };
const input = { url: `${SITE}/`, brandName: "Ravensmoor Athletic" };
const now = (): Date => new Date("2026-11-02T09:00:00.000Z");

const deps = async (over: Partial<ImportDeps> = {}, photos = 5): Promise<ImportDeps> => ({
  fetcher: fakeFetcher(await siteRoutes(photos)),
  limiter: allows,
  styleWriter: createStubStyleWriter(),
  kitFonts: kitFonts(),
  settings: DEFAULT_IMPORT_SETTINGS,
  now,
  ...over,
});

describe("runImport", () => {
  it("imports the five things F-S9 names, and a completion the brand page can show", async () => {
    const run = await runImport(await deps(), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    const { proposal } = run;
    expect(proposal.logos.length).toBeGreaterThan(0);
    expect(proposal.colours.length).toBeGreaterThan(0);
    expect(proposal.fonts).toHaveLength(5);
    expect(proposal.graphics.length).toBeGreaterThan(0);
    expect(proposal.style).not.toBeNull();
    expect(proposal.styleWriter).toBe("stub");
    expect(proposal.items.length).toBeGreaterThan(8);
  });

  it("leaves every item pending, so an import nobody looked at takes nothing in", async () => {
    const run = await runImport(await deps(), who, input);
    expect(run.ok && run.proposal.items.every((item) => item.decision === "pending")).toBe(true);
    expect(run.ok && run.proposal.rights.ticked).toBe(false);
  });

  it("reports all six stages, before and after each, so a minute never looks frozen", async () => {
    const seen: StageReport[] = [];
    const run = await runImport(await deps({ onStage: (report) => seen.push(report) }), who, input);
    expect(run.ok).toBe(true);
    expect(seen.filter((report) => report.status === "running").map((report) => report.stage)).toEqual([...IMPORT_STAGES]);
    expect(run.ok && run.proposal.stages.map((report) => report.stage)).toEqual([...IMPORT_STAGES]);
    expect(run.ok && run.proposal.stages.every((report) => report.status !== "pending" && report.status !== "running")).toBe(true);
  });

  it("times each stage, so a slow site can be seen to be slow", async () => {
    let tick = 0;
    const run = await runImport(await deps({ elapsed: () => (tick += 100) }), who, input);
    expect(run.ok && run.proposal.stages.every((report) => (report.tookMs ?? 0) > 0)).toBe(true);
  });

  it("counts the allowance per brand and per site before it asks the site for anything", async () => {
    const asked: string[] = [];
    const fetcher = fakeFetcher(await siteRoutes());
    const run = await runImport(await deps({ fetcher, limiter: async (key) => (asked.push(key), true) }), who, input);
    expect(run.ok).toBe(true);
    expect(asked).toEqual(["brand-import-run:brand:b1", "brand-import-host:brand:b1:host:ravensmoor.test"]);
  });

  it("refuses over the allowance, and makes no request at all", async () => {
    const fetcher = fakeFetcher(await siteRoutes());
    const run = await runImport(await deps({ fetcher, limiter: refuses }), who, input);
    expect(!run.ok && run.refusal.reason).toBe("rate_limited");
    expect(fetcher.calls).toEqual([]);
  });

  it("refuses a bad address without a request, and says why", async () => {
    const fetcher = fakeFetcher({});
    const run = await runImport(await deps({ fetcher }), who, { ...input, url: "http://ravensmoor.test/" });
    expect(!run.ok && run.refusal.reason).toBe("not_https");
    expect(fetcher.calls).toEqual([]);
  });

  it("stops at the page when the page cannot be read, and only then", async () => {
    const routes = await siteRoutes();
    routes[`${SITE}/robots.txt`] = { type: "text/plain", body: "User-agent: *\nDisallow: /\n" };
    const run = await runImport(await deps({ fetcher: fakeFetcher(routes) }), who, input);
    expect(!run.ok && run.refusal.reason).toBe("robots");
    expect(!run.ok && run.refusal.message).toContain("robots.txt");
  });

  it("writes no visual style from fewer than five of the brand's own pictures, and says so", async () => {
    // Two icons, one mark and the social picture: four of the brand's own, and five are needed.
    const run = await runImport(await deps({}, 0), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    expect(run.proposal.logos.length + run.proposal.graphics.length).toBe(4);
    expect(run.proposal.style).toBeNull();
    const stage = run.proposal.stages.find((report) => report.stage === "style");
    expect(stage?.status).toBe("empty");
    expect(stage?.because).toContain("are needed");
  });

  it("sends the vision writer one of the brand's own pictures, as the provider interface takes one", async () => {
    const writer = createScriptedStyleWriter([{ setting: "A wet pitch.", artDirection: "Long lens.", rulesBoundaries: "None." }]);
    const run = await runImport(await deps({ styleWriter: writer }), who, input);
    expect(run.ok && run.proposal.style?.setting).toBe("A wet pitch.");
    expect(writer.seen[0]?.picture?.mediaType).toBe("image/png");
    expect(writer.seen[0]?.facts.length).toBeGreaterThanOrEqual(5);
  });

  it("sends no picture when none of the brand's own is a type a vision model takes", async () => {
    const routes = await siteRoutes(5);
    for (const [url, reply] of Object.entries(routes)) {
      if (url.endsWith(".png") && !(reply instanceof Error)) routes[url] = { ...reply, type: "image/avif" };
    }
    const writer = createScriptedStyleWriter([{ setting: "A wet pitch.", artDirection: "Long lens.", rulesBoundaries: "None." }]);
    const run = await runImport(await deps({ fetcher: fakeFetcher(routes), styleWriter: writer }), who, input);
    expect(run.ok && run.proposal.style?.setting).toBe("A wet pitch.");
    expect(writer.seen[0]?.picture).toBeUndefined();
  });

  it("sends no picture when the one it chose could not be read a second time", async () => {
    const routes = await siteRoutes(5);
    const fetcher = fakeFetcher(routes);
    let reads = 0;
    const once = (url: string, init: RequestInit): Promise<Response> =>
      url.endsWith("favicon.png") && reads++ > 0 ? Promise.resolve(new Response(null, { status: 404 })) : fetcher(url, init);
    const writer = createScriptedStyleWriter([{ setting: "A wet pitch.", artDirection: "Long lens.", rulesBoundaries: "None." }]);
    const run = await runImport(await deps({ fetcher: once, styleWriter: writer }), who, input);
    expect(run.ok).toBe(true);
    expect(writer.seen[0]?.picture).toBeUndefined();
  });

  it("says the style is missing when the writer answered with nothing", async () => {
    const writer = createScriptedStyleWriter([{ setting: "", artDirection: "", rulesBoundaries: "" }]);
    const run = await runImport(await deps({ styleWriter: writer }), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    expect(run.proposal.style).toBeNull();
    expect(run.proposal.stages.find((report) => report.stage === "style")?.because).toContain("needed");
  });

  it("says the style is missing when the writer threw something that is not an error", async () => {
    const writer = { name: "odd", write: async () => Promise.reject("a string") };
    const run = await runImport(await deps({ styleWriter: writer }), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    expect(run.proposal.style).toBeNull();
    expect(run.proposal.stages.find((report) => report.stage === "style")?.because).toContain("pictures are needed");
  });

  it("keeps everything else when the writer fails, and says why the style is missing", async () => {
    const writer = createScriptedStyleWriter([new Error("The AI allowance is used up.")]);
    const run = await runImport(await deps({ styleWriter: writer }), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    expect(run.proposal.style).toBeNull();
    expect(run.proposal.colours.length).toBeGreaterThan(0);
    expect(run.proposal.stages.find((report) => report.stage === "style")?.because).toContain("allowance");
  });

  it("says a stage found nothing rather than leaving it blank", async () => {
    const routes = await siteRoutes(0);
    routes[`${SITE}/`] = { type: "text/html", body: "<html><head><title>x</title></head><body><p>Hello</p></body></html>" };
    routes[`${SITE}/favicon.ico`] = { status: 404 };
    const run = await runImport(await deps({ fetcher: fakeFetcher(routes) }), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    const empty = run.proposal.stages.filter((report) => report.status === "empty");
    expect(empty.map((report) => report.stage)).toEqual(["logos", "colours", "fonts", "graphics", "style"]);
    expect(empty.every((report) => (report.because ?? "").length > 20)).toBe(true);
  });

  it("stops at the budget and marks what was left out, rather than running on", async () => {
    let tick = 0;
    const run = await runImport(await deps({ elapsed: () => (tick += 20_000) }), who, input);
    if (!run.ok) throw new Error(run.refusal.message);
    const skipped = run.proposal.stages.filter((report) => report.status === "skipped");
    expect(skipped.length).toBeGreaterThan(0);
    expect(skipped.every((report) => (report.because ?? "").includes("minute was up"))).toBe(true);
  });

  it("reads one page and each picture once: no crawl, and nothing twice", async () => {
    const fetcher = fakeFetcher(await siteRoutes());
    await runImport(await deps({ fetcher }), who, input);
    const pages = fetcher.calls.filter((url) => url === `${SITE}/`);
    expect(pages).toHaveLength(1);
    const pictures = fetcher.calls.filter((url) => url.includes("/media/") || url.endsWith("touch.png") || url.endsWith("favicon.png"));
    // Each picture once while it is measured, and one of them a second time for the vision writer.
    expect(new Set(pictures).size).toBeGreaterThan(4);
    expect(pictures.length - new Set(pictures).size).toBe(1);
  });

  it("asks a brand's site for nothing but its robots.txt, its page and its own pictures", async () => {
    const fetcher = fakeFetcher(await siteRoutes());
    await runImport(await deps({ fetcher }), who, input);
    expect(fetcher.calls.every((url) => url.startsWith(`${SITE}/`))).toBe(true);
  });
});
