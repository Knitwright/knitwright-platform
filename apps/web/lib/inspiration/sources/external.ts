import { z } from "zod";
import type { ContextQuery, InspirationCard, SearchLink } from "../types";
import { CARDS_PER_SOURCE } from "../vocabulary";
import { card, type CardProvider, type Fetch } from "./source";

/**
 * The two sources that are not scraped (spec F-S1, fifth and second rows).
 *
 * Behance has issued no new API keys since 2021 and neither site may be scraped, so the board offers **buttons** that
 * open the site with the context query, in a new tab. The person can then drop a link back onto the board, which
 * becomes a link-preview card.
 *
 * A person's own Pinterest boards are read through the official API v5 with their own login. That needs a Pinterest
 * application, so the whole source sits behind `PINTEREST_APP_ID` and the `NEXT_PUBLIC_INSPIRATION_PINTEREST` flag,
 * and production needs Pinterest's Standard access (applied for in phase 2). Pins are shown with a link back.
 */

const BEHANCE_SEARCH = "https://www.behance.net/search/projects";
const PINTEREST_SEARCH = "https://www.pinterest.com/search/pins/";

/** The buttons, in the spec's order. An empty query still opens the site's own search page. */
export function searchLinks(query: ContextQuery): readonly SearchLink[] {
  const text = encodeURIComponent(query.text.trim());
  return [
    { site: "behance", label: "Search on Behance", url: text === "" ? BEHANCE_SEARCH : `${BEHANCE_SEARCH}?search=${text}` },
    { site: "pinterest", label: "Search on Pinterest", url: text === "" ? PINTEREST_SEARCH : `${PINTEREST_SEARCH}?q=${text}` },
  ];
}

/** True only when the application id is set and the flag is on. Without both, the source is not built. */
export const pinterestOn = (env: Readonly<Record<string, string | undefined>> = process.env): boolean =>
  (env["PINTEREST_APP_ID"] ?? "") !== "" && env["NEXT_PUBLIC_INSPIRATION_PINTEREST"] === "on";

const httpsUrl = z.url().refine((value) => value.startsWith("https://"), "Only an https address is shown.");

const pin = z.object({
  id: z.string().min(1).max(64),
  title: z.string().max(200).nullish(),
  alt_text: z.string().max(400).nullish(),
  link: httpsUrl.nullish(),
  media: z.object({ images: z.record(z.string(), z.object({ url: httpsUrl })) }),
});
const pinsAnswer = z.object({ items: z.array(pin).max(100) });

/** The smallest image Pinterest offered, by the key order its API documents. */
const imageOf = (images: z.output<typeof pin>["media"]["images"]): string | null => {
  const keys = Object.keys(images).sort();
  const first = keys[0];
  return first === undefined ? null : (images[first]?.url ?? null);
};

const pinCard = (entry: z.output<typeof pin>): InspirationCard | null => {
  const picture = imageOf(entry.media.images);
  if (picture === null) return null;
  return card("pinterest-board", {
    id: `pin:${entry.id}`,
    title: (entry.title ?? entry.alt_text ?? "A pin").trim().slice(0, 120) || "A pin",
    // A pin always opens on Pinterest, never the picture on its own: their terms ask for the link back.
    openUrl: `https://www.pinterest.com/pin/${entry.id}/`,
    previewUrl: picture,
    owned: false,
    attribution: {
      creator: null,
      creatorUrl: null,
      provider: "Pinterest",
      providerUrl: `https://www.pinterest.com/pin/${entry.id}/`,
      notice: "A pin from your own Pinterest board, shown with a link back to it.",
    },
  });
};

/** What one person's Pinterest login gives us: a token and the boards they chose. */
export type PinterestAccess = Readonly<{ accessToken: string; boardIds: readonly string[] }>;

/**
 * The pins of the boards a person chose. Pinterest's API has no search inside a board, so the pins of the chosen
 * boards are listed and matched against the query here; nothing is cached beyond the request.
 */
export function pinterestProvider(access: PinterestAccess, fetchJson: Fetch): CardProvider {
  return {
    source: "pinterest-board",
    name: "pinterest-v5",
    async search(query, signal) {
      const asked = new Set(query.tags.map((tag) => tag.text));
      const perBoard = await Promise.all(
        access.boardIds.slice(0, 5).map(async (boardId) => {
          const url = `https://api.pinterest.com/v5/boards/${encodeURIComponent(boardId)}/pins?page_size=${CARDS_PER_SOURCE}`;
          const answer = await fetchJson(url, { headers: { Authorization: `Bearer ${access.accessToken}` }, signal }).catch(() => null);
          if (answer === null || !answer.ok) return [];
          const body = pinsAnswer.safeParse(await answer.json().catch(() => null));
          return body.success ? body.data.items : [];
        }),
      );
      const matches = perBoard.flat().filter((entry) => {
        const words = `${entry.title ?? ""} ${entry.alt_text ?? ""}`.toLowerCase();
        return asked.size === 0 || [...asked].some((tag) => words.includes(tag));
      });
      return matches.slice(0, CARDS_PER_SOURCE).flatMap((entry) => {
        const made = pinCard(entry);
        return made === null ? [] : [made];
      });
    },
  };
}
