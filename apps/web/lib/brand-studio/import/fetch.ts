/**
 * The polite fetch of the brand's **own** page, and of the pictures that page points at.
 *
 * The discipline is Z3's (decision 0084, `lib/benchmarks/fetch.ts`), and the pieces that can be
 * shared are imported from it rather than written again: `normaliseUrl` for the address,
 * `wordsOfPage` for the plain words, and `robotsAllows` for robots.txt, which already takes the
 * agent name as an argument. The list of addresses that are not a public web page was the one piece
 * this file did write again, because Z3 did not export it; review v5 (decision 0110) moved it to
 * `lib/http/public-url.ts` and both fetchers now ask that one list.
 * What is different here is deliberate and is listed in decision 0102:
 * **https only** (Z3 allows http because a product page may be old), a user agent of our own so a
 * site owner can allow or refuse brand import on its own, and a second kind of request — a picture
 * — which Z3 never makes at all.
 *
 * Nothing here returns markup to its caller. `readOwnPage` hands the page's words and the addresses
 * it points at to `linksOfPage`, and the markup goes out of scope on that line.
 */

import { normaliseUrl, wordsOfPage, type Fetcher } from "@/lib/benchmarks/fetch";
import { isPrivateHost } from "@/lib/http/public-url";
import { robotsAllows } from "@/lib/benchmarks/robots";
import { linksOfPage } from "./discover";
import type { ImportRefusal, SiteSource } from "./types";
import { IMPORT_ROBOTS_NAME, IMPORT_USER_AGENT, REFUSALS, WORTH_RETRYING, type RefusalReason } from "./words";
import type { BrandImportSettings } from "./settings";

export type { Fetcher };

/** The picture types `sharp` reads and a vision model takes. An SVG is a drawing, read separately. */
export const PICTURE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/avif", "image/svg+xml"] as const;

export const refuse = (reason: RefusalReason): ImportRefusal => ({
  reason,
  message: REFUSALS[reason],
  canRetry: WORTH_RETRYING.includes(reason),
});

export type PageOutcome = Readonly<{ ok: true; page: SiteSource }> | Readonly<{ ok: false; refusal: ImportRefusal }>;
export type BytesOutcome =
  | Readonly<{ ok: true; bytes: Uint8Array; contentType: string }>
  | Readonly<{ ok: false; refusal: ImportRefusal }>;

const HEADERS = { "user-agent": IMPORT_USER_AGENT, "accept-language": "en" } as const;

/** Logged out, on purpose: no cookies go out, none are kept, and nothing is cached. */
const politely = (signal: AbortSignal, accept: string): RequestInit => ({
  method: "GET",
  headers: { ...HEADERS, accept },
  redirect: "follow",
  cache: "no-store",
  credentials: "omit",
  signal,
});

/** The https address of a public page, or the reason it is not one. */
export function ownUrl(raw: string): Readonly<{ ok: true; url: URL }> | Readonly<{ ok: false; refusal: ImportRefusal }> {
  const url = normaliseUrl(raw);
  if (url === null) return { ok: false, refusal: refuse("bad_url") };
  if (url.protocol !== "https:") return { ok: false, refusal: refuse("not_https") };
  if (isPrivateHost(url.hostname)) return { ok: false, refusal: refuse("private_host") };
  return { ok: true, url };
}

/** An abort of our own is "too slow"; anything else the network did is "unreachable". */
const networkRefusal = (signal: AbortSignal): ImportRefusal => refuse(signal.aborted ? "too_slow" : "unreachable");

const readRobots = async (fetcher: Fetcher, url: URL, signal: AbortSignal): Promise<string | null | "unreadable"> => {
  try {
    const reply = await fetcher(`https://${url.host}/robots.txt`, politely(signal, "text/plain"));
    if (reply.status === 404 || reply.status === 410) return null;
    if (!reply.ok) return "unreadable";
    return (await reply.text()).slice(0, 500_000);
  } catch {
    return "unreadable";
  }
};

/** robots.txt for our own agent name. Unreadable counts as a refusal: a polite fetcher does not guess. */
export async function mayRead(fetcher: Fetcher, url: URL, signal: AbortSignal): Promise<boolean> {
  const robots = await readRobots(fetcher, url, signal);
  if (robots === "unreadable") return false;
  return robotsAllows(robots, url.toString(), IMPORT_ROBOTS_NAME);
}

const tooLarge = (reply: Response, cap: number): boolean => Number(reply.headers.get("content-length") ?? "0") > cap;

/**
 * One page of the brand's own site: robots.txt, then the page, and nothing else. Two requests, no
 * crawl. The caller has already counted this brand's allowance (`run.ts`).
 */
export async function readOwnPage(fetcher: Fetcher, raw: string, settings: BrandImportSettings, now: () => Date = () => new Date()): Promise<PageOutcome> {
  const address = ownUrl(raw);
  if (!address.ok) return address;
  const { url } = address;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  try {
    if (!(await mayRead(fetcher, url, controller.signal))) return { ok: false, refusal: refuse("robots") };
    const reply = await fetcher(url.toString(), politely(controller.signal, "text/html,application/xhtml+xml;q=0.9"));
    if (!reply.ok) return { ok: false, refusal: refuse("unreachable") };
    if (!/^(text\/html|application\/xhtml\+xml)/i.test(reply.headers.get("content-type") ?? "")) return { ok: false, refusal: refuse("not_a_page") };
    if (tooLarge(reply, settings.pageBytes)) return { ok: false, refusal: refuse("too_large") };
    // The one place third-party markup exists. It is read, turned into words and addresses, and
    // goes out of scope here: nothing below this line can reach it.
    const html = (await reply.text()).slice(0, settings.pageBytes);
    const read = wordsOfPage(html);
    const links = linksOfPage(html, url.toString());
    return { ok: true, page: { url: url.toString(), host: url.host, title: read.title, words: read.words, links, fetchedAt: now().toISOString() } };
  } catch {
    return { ok: false, refusal: networkRefusal(controller.signal) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * One picture's bytes, bounded and typed. The bytes are for measuring and for an upload the person
 * has asked for; nothing in this module keeps them, and no shape in `types.ts` can carry them.
 */
export async function readPicture(fetcher: Fetcher, raw: string, settings: BrandImportSettings): Promise<BytesOutcome> {
  const address = ownUrl(raw);
  if (!address.ok) return address;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), settings.timeoutMs);
  try {
    const reply = await fetcher(address.url.toString(), politely(controller.signal, "image/*"));
    if (!reply.ok) return { ok: false, refusal: refuse("unreachable") };
    const contentType = (reply.headers.get("content-type") ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
    if (!PICTURE_TYPES.some((known) => known === contentType)) return { ok: false, refusal: refuse("not_a_page") };
    if (tooLarge(reply, settings.pictureBytes)) return { ok: false, refusal: refuse("too_large") };
    const bytes = new Uint8Array(await reply.arrayBuffer());
    if (bytes.byteLength > settings.pictureBytes) return { ok: false, refusal: refuse("too_large") };
    return { ok: true, bytes, contentType };
  } catch {
    return { ok: false, refusal: networkRefusal(controller.signal) };
  } finally {
    clearTimeout(timer);
  }
}
