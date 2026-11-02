import { createHash } from "node:crypto";
import { plain } from "./scrub";
import { robotsAllows } from "./robots";
import { BENCHMARK_USER_AGENT } from "./vocabulary";

/**
 * One fetch of one page (spec F-S2 step 2): logged out, with our own user agent, robots.txt honoured, and nothing
 * followed off the page. The page's source never leaves this file: what comes back is the plain words the extractor
 * reads, and nothing here is written to the database (lib/benchmarks/store.ts stores the card only).
 */

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

/** The words of one page, for the extractor to read. Never stored, never shown. */
export type PageWords = Readonly<{ url: string; host: string; title: string | null; words: string; fetchedAt: string }>;

export type FetchRefusal = "bad_url" | "private_host" | "robots" | "not_a_page" | "too_large" | "unreachable";

export type FetchOutcome = Readonly<{ ok: true; page: PageWords }> | Readonly<{ ok: false; reason: FetchRefusal; message: string }>;

/** A page over this is not read: a product page is words, not a download. */
export const MAX_PAGE_BYTES = 2_000_000;
/** The most words handed to the extractor. */
export const MAX_WORDS_CHARS = 12_000;
export const FETCH_TIMEOUT_MS = 10_000;

const PRIVATE_HOST =
  /^(localhost|\[?::1\]?|0\.0\.0\.0|10\.\d+\.\d+\.\d+|127\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+)$|\.(local|internal|localhost)$/i;

export const REFUSALS: Readonly<Record<FetchRefusal, string>> = {
  bad_url: "Paste the address of a product page, starting with https://.",
  private_host: "That address is not a public web page.",
  robots: "That site's robots.txt asks us not to read this page, so we have not.",
  not_a_page: "That address is not a web page we can read.",
  too_large: "That page is too big to read.",
  unreachable: "That page could not be reached. Try again, or upload a photo instead.",
};

const refuse = (reason: FetchRefusal): FetchOutcome => ({ ok: false, reason, message: REFUSALS[reason] });

/** The URL as we fetch and key it: https or http, no user info, no fragment. */
export function normaliseUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username !== "" || url.password !== "") return null;
  url.hash = "";
  return url;
}

/** The key a fetch is counted and remembered under, so one URL is fetched once per brand. */
export const urlKey = (url: string): string => createHash("sha256").update(normaliseUrl(url)?.toString() ?? url.trim()).digest("hex");

const HEADERS = {
  "user-agent": BENCHMARK_USER_AGENT,
  accept: "text/html,text/plain;q=0.8",
  "accept-language": "en",
} as const;

/** Logged out, on purpose: no cookies are sent, none are kept, and nothing is cached. */
const politely = (signal: AbortSignal): RequestInit => ({ method: "GET", headers: HEADERS, redirect: "follow", cache: "no-store", credentials: "omit", signal });

const readRobots = async (fetcher: Fetcher, url: URL, signal: AbortSignal): Promise<string | null | "unreadable"> => {
  try {
    const reply = await fetcher(`${url.protocol}//${url.host}/robots.txt`, politely(signal));
    if (reply.status === 404 || reply.status === 410) return null;
    if (!reply.ok) return "unreadable";
    return (await reply.text()).slice(0, 500_000);
  } catch {
    return "unreadable";
  }
};

/** Scripts, styles and tags out; words in. The markup is dropped here and never returned. */
export function wordsOfPage(html: string): Readonly<{ title: string | null; words: string }> {
  const title = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1];
  const described = [...html.matchAll(/<meta[^>]+content=["']([^"']{0,400})["'][^>]*>/gi)]
    .filter((m) => /property=["']og:(title|description)["']|name=["'](description|twitter:description)["']/i.test(m[0]))
    .map((m) => m[1] ?? "");
  const body = html
    .replace(/<(script|style|noscript|template|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]*>/g, " ");
  const text = plain([...described, body].join(" . ")).replace(/[<>]/g, " ");
  return { title: title === undefined ? null : plain(title).replace(/[<>]/g, "") || null, words: text.slice(0, MAX_WORDS_CHARS) };
}

/**
 * robots.txt, then the page, and nothing else: two requests, no crawl. The caller has already checked that this brand
 * has not fetched this URL before and is within its rate limit (lib/benchmarks/service.ts).
 */
export async function fetchProductPage(fetcher: Fetcher, raw: string, now: () => Date = () => new Date()): Promise<FetchOutcome> {
  const url = normaliseUrl(raw);
  if (url === null) return refuse("bad_url");
  if (PRIVATE_HOST.test(url.hostname)) return refuse("private_host");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const robots = await readRobots(fetcher, url, controller.signal);
    if (robots === "unreadable") return refuse("robots");
    if (!robotsAllows(robots, url.toString())) return refuse("robots");
    const reply = await fetcher(url.toString(), politely(controller.signal));
    if (!reply.ok) return refuse("unreachable");
    const type = reply.headers.get("content-type") ?? "";
    if (!/^(text\/html|application\/xhtml\+xml|text\/plain)/i.test(type)) return refuse("not_a_page");
    const length = Number(reply.headers.get("content-length") ?? "0");
    if (length > MAX_PAGE_BYTES) return refuse("too_large");
    const html = (await reply.text()).slice(0, MAX_PAGE_BYTES);
    const read = wordsOfPage(html);
    return { ok: true, page: { url: url.toString(), host: url.host, title: read.title, words: read.words, fetchedAt: now().toISOString() } };
  } catch {
    return refuse("unreachable");
  } finally {
    clearTimeout(timer);
  }
}
