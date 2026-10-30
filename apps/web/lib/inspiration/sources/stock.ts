import { z } from "zod";
import type { ContextQuery, InspirationCard } from "../types";
import { CARDS_PER_SOURCE } from "../vocabulary";
import { card, type CardProvider, type Fetch } from "./source";

/**
 * Licensed stock photography: the Unsplash and Pexels APIs, searched with the context query (spec F-S1).
 *
 * Both providers' terms are kept the same way: the picture is **hotlinked** from the address the API returned and
 * never copied to Knitwright, the card opens the photo's own page, and the photographer and the provider are named
 * under it. A key is optional; without one the source is not built and the board says so.
 */

const UNSPLASH_SEARCH = "https://api.unsplash.com/search/photos";
const PEXELS_SEARCH = "https://api.pexels.com/v1/search";

/** Unsplash asks every application to add these to the links it shows (their API guidelines). */
const UTM = "utm_source=knitwright&utm_medium=referral";

const httpsUrl = z.url().refine((value) => value.startsWith("https://"), "Only an https address is shown.");

const unsplashPhoto = z.object({
  id: z.string().min(1).max(64),
  description: z.string().nullish(),
  alt_description: z.string().nullish(),
  urls: z.object({ small: httpsUrl }),
  links: z.object({ html: httpsUrl }),
  user: z.object({ name: z.string().max(120), links: z.object({ html: httpsUrl }).partial().optional() }),
});
const unsplashAnswer = z.object({ results: z.array(unsplashPhoto).max(50) });

const pexelsPhoto = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  alt: z.string().nullish(),
  url: httpsUrl,
  src: z.object({ medium: httpsUrl }),
  photographer: z.string().max(120),
  photographer_url: httpsUrl.nullish(),
});
const pexelsAnswer = z.object({ photos: z.array(pexelsPhoto).max(50) });

const withUtm = (url: string): string => `${url}${url.includes("?") ? "&" : "?"}${UTM}`;

const titleOf = (...parts: readonly (string | null | undefined)[]): string => {
  const found = parts.find((part) => typeof part === "string" && part.trim() !== "");
  return (found ?? "A stock photo").trim().slice(0, 120);
};

/** A reply the provider gave that does not read as its own documented shape is treated as nothing found. */
async function read<T>(answer: Response, schema: z.ZodType<T>): Promise<T | null> {
  if (!answer.ok) return null;
  const parsed = schema.safeParse(await answer.json().catch(() => null));
  return parsed.success ? parsed.data : null;
}

const searchText = (query: ContextQuery): string => query.text.trim();

function unsplashCards(photos: z.output<typeof unsplashAnswer>): readonly InspirationCard[] {
  return photos.results.slice(0, CARDS_PER_SOURCE).map((photo) =>
    card("unsplash", {
      id: `unsplash:${photo.id}`,
      title: titleOf(photo.description, photo.alt_description),
      openUrl: withUtm(photo.links.html),
      previewUrl: photo.urls.small,
      owned: false,
      attribution: {
        creator: photo.user.name,
        creatorUrl: photo.user.links?.html ? withUtm(photo.user.links.html) : null,
        provider: "Unsplash",
        providerUrl: `https://unsplash.com/?${UTM}`,
        notice: `Photo by ${photo.user.name} on Unsplash`,
      },
    }),
  );
}

/** Unsplash, behind `UNSPLASH_ACCESS_KEY`. Nothing is cached and nothing is stored. */
export function unsplashProvider(apiKey: string, fetchJson: Fetch): CardProvider {
  return {
    source: "unsplash",
    name: "unsplash",
    async search(query, signal) {
      const text = searchText(query);
      if (text === "") return [];
      const url = `${UNSPLASH_SEARCH}?query=${encodeURIComponent(text)}&per_page=${CARDS_PER_SOURCE}&content_filter=high`;
      const answer = await fetchJson(url, { headers: { Authorization: `Client-ID ${apiKey}`, "Accept-Version": "v1" }, signal });
      const body = await read(answer, unsplashAnswer);
      return body === null ? [] : unsplashCards(body);
    },
  };
}

function pexelsCards(photos: z.output<typeof pexelsAnswer>): readonly InspirationCard[] {
  return photos.photos.slice(0, CARDS_PER_SOURCE).map((photo) =>
    card("pexels", {
      id: `pexels:${photo.id}`,
      title: titleOf(photo.alt),
      openUrl: photo.url,
      previewUrl: photo.src.medium,
      owned: false,
      attribution: {
        creator: photo.photographer,
        creatorUrl: photo.photographer_url ?? null,
        provider: "Pexels",
        providerUrl: "https://www.pexels.com",
        notice: `Photo by ${photo.photographer} on Pexels`,
      },
    }),
  );
}

/** Pexels, behind `PEXELS_API_KEY`. */
export function pexelsProvider(apiKey: string, fetchJson: Fetch): CardProvider {
  return {
    source: "pexels",
    name: "pexels",
    async search(query, signal) {
      const text = searchText(query);
      if (text === "") return [];
      const url = `${PEXELS_SEARCH}?query=${encodeURIComponent(text)}&per_page=${CARDS_PER_SOURCE}`;
      const answer = await fetchJson(url, { headers: { Authorization: apiKey }, signal });
      const body = await read(answer, pexelsAnswer);
      return body === null ? [] : pexelsCards(body);
    },
  };
}
