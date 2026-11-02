import sharp from "sharp";
import type { KitFont } from "../../types";
import type { Fetcher } from "../fetch";

/**
 * The fixtures for brand import. **Every one is made here**: no real brand's page, logo, photo or
 * stylesheet is committed, and no test of this directory ever reaches the network — the fetcher
 * below throws on an address it was not given, which is how `fetch.test.ts` proves it.
 */

export const HOST = "ravensmoor.test";
export const SITE = `https://${HOST}`;

/** A PNG of bands, as a brand's logo or product photo would be. Drawn here, byte for byte. */
export const png = async (bands: readonly (readonly [string, number])[], width = 64): Promise<Buffer> => {
  const height = bands.reduce((sum, [, rows]) => sum + rows, 0);
  const rects = bands.map(([hex, rows], at) => {
    const top = bands.slice(0, at).reduce((sum, [, before]) => sum + before, 0);
    return `<rect x="0" y="${top}" width="${width}" height="${rows}" fill="${hex}" />`;
  });
  return sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rects.join("")}</svg>`))
    .png()
    .toBuffer();
};

export const navyAndGold = (): Promise<Buffer> => png([["#0b1f4b", 48], ["#ffd100", 16]]);

/** A page of a made-up club's site: a favicon, a mark, five product photos, colours and two fonts. */
export const pageHtml = (photos = 5): string =>
  `<!doctype html><html lang="en"><head>
    <title>Ravensmoor Athletic — club shop</title>
    <meta property="og:image" content="${SITE}/media/hero.png" />
    <meta name="theme-color" content="#0b1f4b" />
    <link rel="icon" href="/favicon.png" />
    <link rel="apple-touch-icon" href="${SITE}/touch.png" />
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Source+Serif+4" />
    <link rel="stylesheet" href="https://other.test/not-ours.css" />
    <style>
      :root { --brand: #0b1f4b; --accent: rgb(255, 209, 0); --paper: #ffffff; }
      body { font-family: "Source Serif 4", Georgia, serif; color: #1b1b1b; }
      h1 { font-family: "Bebas Neue", sans-serif; background: #c8102e; }
    </style>
  </head><body>
    <h1>Ravensmoor Athletic</h1>
    <img src="/media/logo.png" alt="Ravensmoor Athletic crest" />
    <img src="https://tracker.test/1x1.png" alt="" />
    <img src="/media/spacer.gif" alt="" />
    ${Array.from({ length: photos }, (_, at) => `<img src="/media/shirt-${at + 1}.png" alt="Home shirt ${at + 1}" />`).join("")}
    <p style="color:#2f6f4f">Made in the north since 1897.</p>
  </body></html>`;

type Reply = Readonly<{ status?: number; type?: string; body?: string | Uint8Array }>;

const response = (reply: Reply): Response => {
  const status = reply.status ?? 200;
  const headers = new Headers(reply.type === undefined ? {} : { "content-type": reply.type });
  const body = reply.body === undefined ? null : typeof reply.body === "string" ? reply.body : new Uint8Array(reply.body);
  return new Response(status === 204 || status === 304 ? null : body, { status, headers });
};

export interface FakeFetcher {
  (url: string, init: RequestInit): Promise<Response>;
  readonly calls: string[];
  readonly agents: (string | null)[];
}

/**
 * A fetcher that answers only the addresses it was given and **throws** on any other, so a test
 * that would reach the network fails instead of making a request.
 */
export function fakeFetcher(routes: Readonly<Record<string, Reply | Error>>): FakeFetcher {
  const calls: string[] = [];
  const agents: (string | null)[] = [];
  const fetcher = (async (url: string, init: RequestInit) => {
    calls.push(url);
    agents.push(new Headers(init.headers).get("user-agent"));
    const reply = routes[url];
    if (reply === undefined) throw new Error(`No fixture for ${url}`);
    if (reply instanceof Error) throw reply;
    return response(reply);
  }) as FakeFetcher;
  return Object.assign(fetcher, { calls, agents });
}

/** The routes of the made-up site: robots.txt, the page, the icons and the photos. */
export async function siteRoutes(photos = 5): Promise<Record<string, Reply>> {
  const logo = await navyAndGold();
  const shirt = await png([["#0b1f4b", 40], ["#c8102e", 24]], 80);
  const routes: Record<string, Reply> = {
    [`${SITE}/robots.txt`]: { status: 404 },
    [`${SITE}/`]: { type: "text/html; charset=utf-8", body: pageHtml(photos) },
    [`${SITE}/favicon.png`]: { type: "image/png", body: logo },
    [`${SITE}/touch.png`]: { type: "image/png", body: logo },
    [`${SITE}/media/logo.png`]: { type: "image/png", body: logo },
    [`${SITE}/media/hero.png`]: { type: "image/png", body: shirt },
  };
  for (let at = 1; at <= photos; at += 1) routes[`${SITE}/media/shirt-${at}.png`] = { type: "image/png", body: shirt };
  return routes;
}

/** The licensed font list as decision 0079 seeds it: two bundled faces, four labelled placeholders. */
export const kitFonts = (): readonly KitFont[] => [
  { key: "geist", label: "Geist Sans", family: "var(--font-sans)", licence: "bundled", licenceNote: "SIL Open Font License 1.1.", selectable: true },
  { key: "geist-mono", label: "Geist Mono", family: "var(--font-mono)", licence: "bundled", licenceNote: "SIL Open Font License 1.1.", selectable: true },
  ...(["block", "condensed", "serif", "stencil"] as const).map((kind) => ({
    key: `placeholder-${kind}`,
    label: `Placeholder: ${kind === "block" ? "wide block sans" : kind === "condensed" ? "condensed sans" : kind === "serif" ? "editorial serif" : "stencil"}`,
    family: "",
    licence: "not_established" as const,
    licenceNote: "Placeholder, not reviewed by anyone. No licence for a font of this kind is on file, so it cannot be chosen yet.",
    selectable: false,
  })),
];

/** A limiter that always allows, and one that always refuses, for the allowance tests. */
export const allows: (key: string) => Promise<boolean> = async () => true;
export const refuses: (key: string) => Promise<boolean> = async () => false;

export type { Fetcher };
