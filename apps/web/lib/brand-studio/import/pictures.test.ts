import { describe, expect, it } from "vitest";
import { deltaE } from "@/lib/print/rules/colour";
import { SMALLEST_PICTURE_PX, factsOf, pictureDetail, readPictures } from "./pictures";
import { DEFAULT_IMPORT_SETTINGS } from "./settings";
import { SITE, fakeFetcher, navyAndGold, png, siteRoutes } from "./fixtures/site";
import type { Candidate } from "./types";

/** What a picture turns out to be. The pictures are drawn in the fixtures: none is committed. */

const settings = DEFAULT_IMPORT_SETTINGS;
const from = (url: string, alt: string | null = null): Candidate => ({ url, why: "img-logo", alt });

describe("factsOf", () => {
  it("measures a picture and reads its colours, dominant first", async () => {
    const read = await factsOf(new Uint8Array(await navyAndGold()), "image/png", from(`${SITE}/media/logo.png`, "Crest"), settings);
    if (!read.ok) throw new Error(read.because);
    expect(read.facts).toMatchObject({ widthPx: 64, heightPx: 64, contentType: "image/png", alt: "Crest" });
    expect(deltaE(read.facts.swatches[0]?.hex ?? "#000000", "#0b1f4b")).toBeLessThan(5);
    expect(read.facts.swatches[0]?.share).toBeGreaterThan(read.facts.swatches[1]?.share ?? 1);
  });

  it("keeps no bytes: the facts are numbers, strings and colours", async () => {
    const read = await factsOf(new Uint8Array(await navyAndGold()), "image/png", from(`${SITE}/x.png`), settings);
    if (!read.ok) throw new Error(read.because);
    expect(Object.keys(read.facts).sort()).toEqual(["alt", "bytes", "contentType", "heightPx", "swatches", "url", "why", "widthPx"]);
    expect(typeof read.facts.bytes).toBe("number");
  });

  it("leaves out a picture too small to be a logo or a photo", async () => {
    const tiny = await png([["#0b1f4b", 4]], 4);
    const read = await factsOf(new Uint8Array(tiny), "image/png", from(`${SITE}/dot.png`), settings);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.because).toContain("too small");
    expect(SMALLEST_PICTURE_PX).toBeGreaterThan(4);
  });

  it("leaves out a picture wide enough but not tall enough", async () => {
    const strip = await png([["#0b1f4b", 4]], 64);
    const read = await factsOf(new Uint8Array(strip), "image/png", from(`${SITE}/rule.png`), settings);
    expect(read.ok).toBe(false);
  });

  it("says so rather than throwing when the bytes are not a picture at all", async () => {
    const read = await factsOf(new Uint8Array([1, 2, 3]), "image/png", from(`${SITE}/x.png`), settings);
    expect(read.ok).toBe(false);
    expect(!read.ok && read.because).toContain("could not be read");
  });
});

describe("readPictures", () => {
  it("reads the candidates one at a time, in the order the page offered them", async () => {
    const fetcher = fakeFetcher(await siteRoutes(2));
    const found = await readPictures({ fetcher, settings }, [from(`${SITE}/media/logo.png`), from(`${SITE}/media/shirt-1.png`)], 5);
    expect(found.map((facts) => facts.url)).toEqual([`${SITE}/media/logo.png`, `${SITE}/media/shirt-1.png`]);
    expect(fetcher.calls).toEqual([`${SITE}/media/logo.png`, `${SITE}/media/shirt-1.png`]);
  });

  it("stops at the allowance, however many the page offered", async () => {
    const fetcher = fakeFetcher(await siteRoutes(3));
    const found = await readPictures({ fetcher, settings }, [1, 2, 3].map((at) => from(`${SITE}/media/shirt-${at}.png`)), 2);
    expect(found).toHaveLength(2);
    expect(fetcher.calls).toHaveLength(2);
  });

  it("stops when the budget has gone, and makes no further request", async () => {
    const fetcher = fakeFetcher(await siteRoutes(2));
    let left = 1;
    const found = await readPictures({ fetcher, settings, before: () => left-- > 0 }, [1, 2].map((at) => from(`${SITE}/media/shirt-${at}.png`)), 5);
    expect(found).toHaveLength(1);
    expect(fetcher.calls).toHaveLength(1);
  });

  it("walks past a picture it could not fetch or could not read", async () => {
    const routes = await siteRoutes(1);
    routes[`${SITE}/gone.png`] = { status: 404 };
    routes[`${SITE}/broken.png`] = { type: "image/png", body: new Uint8Array([9, 9]) };
    const found = await readPictures({ fetcher: fakeFetcher(routes), settings }, [
      from(`${SITE}/gone.png`),
      from(`${SITE}/broken.png`),
      from(`${SITE}/media/shirt-1.png`),
    ], 5);
    expect(found.map((facts) => facts.url)).toEqual([`${SITE}/media/shirt-1.png`]);
  });
});

describe("pictureDetail", () => {
  it("says the size, the type and what the page called it", async () => {
    const read = await factsOf(new Uint8Array(await navyAndGold()), "image/png", from(`${SITE}/x.png`, "Home shirt"), settings);
    if (!read.ok) throw new Error(read.because);
    expect(pictureDetail(read.facts)).toBe("64 × 64 px · PNG · Home shirt");
  });

  it("leaves out what the page did not say", async () => {
    const read = await factsOf(new Uint8Array(await navyAndGold()), "image/png", from(`${SITE}/x.png`), settings);
    if (!read.ok) throw new Error(read.because);
    expect(pictureDetail(read.facts)).toBe("64 × 64 px · PNG");
  });
});
