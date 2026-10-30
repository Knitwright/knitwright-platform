import type { LibraryReader } from "../ports";
import type { ContextQuery, InspirationCard } from "../types";
import { CARDS_PER_SOURCE } from "../vocabulary";
import { card, type CardProvider } from "./source";

/**
 * Knitwright's own library: templates, past designs a brand gave permission for, and sample photos (spec F-S1, first
 * row). It is fully owned, so a card from here is the one a suggestion may be drawn from directly, and its picture is
 * served by Knitwright rather than hotlinked from anyone.
 */

/** How well an item answers the query: the number of its tags the query also holds. Zero means it is left out. */
export const scoreItem = (tags: readonly string[], query: ContextQuery): number => {
  const asked = new Set(query.tags.map((tag) => tag.text));
  return tags.filter((tag) => asked.has(tag.toLowerCase())).length;
};

export function libraryProvider(reader: LibraryReader, brandId: string): CardProvider {
  return {
    source: "knitwright-library",
    name: "knitwright-library",
    async search(query, signal) {
      const items = await reader.search(brandId, query, signal);
      const scored = items.map((item) => ({ item, score: scoreItem(item.tags, query) })).filter((entry) => entry.score > 0);
      // Best match first, then by id, so two refreshes of the same board give the same order.
      scored.sort((left, right) => right.score - left.score || left.item.id.localeCompare(right.item.id));
      return scored.slice(0, CARDS_PER_SOURCE).map(({ item }): InspirationCard =>
        card("knitwright-library", {
          id: `library:${item.id}`,
          title: item.title,
          openUrl: item.openUrl,
          previewUrl: item.previewUrl,
          owned: true,
          attribution: { creator: null, creatorUrl: null, provider: "Knitwright", providerUrl: null, notice: `${item.kindLabel} from the Knitwright library` },
        }),
      );
    },
  };
}
