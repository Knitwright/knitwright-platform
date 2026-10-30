import { z } from "zod";
import type { InspirationCard } from "../types";
import { card, type CardProvider, type Fetch } from "./source";

/**
 * Link-preview cards for product links a person adds (spec F-S1, fourth row; F-S2 adds the links). The page is
 * fetched **once**, logged out, on the server, and **nothing of it is stored**: the HTML is read for its Open Graph
 * title, picture and price, the words are kept, the HTML is dropped. The card opens the source and is never artwork.
 */

/** The most of a page we will read. A product page's head is in the first part of it. */
const MAX_BYTES = 512 * 1024;

/** A page that does not answer quickly is not worth the refresh budget. */
export const PREVIEW_TIMEOUT_MS = 2_000;

/** Said when a link gives no preview. The card is not shown; the person keeps the link. */
export const NO_PREVIEW = "That page gave no preview, so there is no card for it. The link still opens.";

export const previewUrlSchema = z
  .url()
  .max(2048)
  .refine((value) => value.startsWith("https://"), "Give an https address.");

const ENTITIES: Readonly<Record<string, string>> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'" };

const decodeEntities = (text: string): string => text.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (found) => ENTITIES[found] ?? found);

const metaOf = (html: string, property: string): string | null => {
  const pattern = new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]*>`, "i");
  const tag = pattern.exec(html)?.[0];
  if (tag === undefined) return null;
  const content = /content=["']([^"']*)["']/i.exec(tag)?.[1];
  return content === undefined || content.trim() === "" ? null : decodeEntities(content.trim()).slice(0, 200);
};

const titleTag = (html: string): string | null => {
  const found = /<title[^>]*>([\s\S]{0,300}?)<\/title>/i.exec(html)?.[1];
  return found === undefined || found.trim() === "" ? null : decodeEntities(found.trim()).slice(0, 200);
};

/** What one page said about itself. Derived words only: never the page. */
export type LinkPreview = Readonly<{ title: string; previewUrl: string | null; price: string | null; siteName: string | null }>;

/** Reads the Open Graph words out of a page's HTML. Pure, so the test needs no network. */
export function previewFromHtml(html: string): LinkPreview | null {
  const head = html.slice(0, MAX_BYTES);
  const title = metaOf(head, "og:title") ?? titleTag(head);
  if (title === null) return null;
  const picture = metaOf(head, "og:image");
  const amount = metaOf(head, "product:price:amount") ?? metaOf(head, "og:price:amount");
  const currency = metaOf(head, "product:price:currency") ?? metaOf(head, "og:price:currency");
  return {
    title,
    previewUrl: picture !== null && picture.startsWith("https://") ? picture : null,
    price: amount === null ? null : [amount, currency].filter((part) => part !== null).join(" "),
    siteName: metaOf(head, "og:site_name"),
  };
}

const hostOf = (url: string): string => {
  try {
    return new URL(url).host;
  } catch {
    return "the source";
  }
};

/** The card one link becomes. The picture is hotlinked from the page that offered it; no copy is kept. */
export function previewCard(url: string, preview: LinkPreview): InspirationCard {
  const site = preview.siteName ?? hostOf(url);
  return card("link-preview", {
    id: `link:${url}`,
    title: preview.price === null ? preview.title : `${preview.title} — ${preview.price}`,
    openUrl: url,
    previewUrl: preview.previewUrl ?? "",
    owned: false,
    attribution: { creator: null, creatorUrl: null, provider: site, providerUrl: url, notice: `From ${site}. Shown as a link, never used as artwork.` },
  });
}

/**
 * Fetches one page once, logged out, and reads its preview. The body is read as text and dropped; a page larger than
 * `MAX_BYTES` is cut, never kept. A fault or a refusal gives null, and the board says the link gave no preview.
 */
export async function fetchPreview(url: string, fetchPage: Fetch, signal?: AbortSignal): Promise<LinkPreview | null> {
  const asked = previewUrlSchema.safeParse(url);
  if (!asked.success) return null;
  const answer = await fetchPage(asked.data, {
    redirect: "follow",
    headers: { Accept: "text/html,application/xhtml+xml", "User-Agent": "KnitwrightInspiration/1.0 (+https://knitwright.com/bot)" },
    ...(signal ? { signal } : {}),
  }).catch(() => null);
  if (answer === null || !answer.ok) return null;
  const type = answer.headers.get("content-type") ?? "";
  if (!type.includes("html")) return null;
  const html = (await answer.text().catch(() => "")).slice(0, MAX_BYTES);
  return html === "" ? null : previewFromHtml(html);
}

/**
 * The product links a person added, as cards. Each page is fetched once, in parallel, inside the board's budget; a
 * page that gives no preview is simply left out.
 */
export function linkPreviewProvider(urls: readonly string[], fetchPage: Fetch): CardProvider {
  return {
    source: "link-preview",
    name: "link-preview",
    async search(_query, signal) {
      const found = await Promise.all(
        urls.map(async (url) => {
          const preview = await fetchPreview(url, fetchPage, signal);
          return preview === null ? null : previewCard(url, preview);
        }),
      );
      return found.filter((entry): entry is InspirationCard => entry !== null);
    },
  };
}
