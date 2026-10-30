import { describe, expect, it } from "vitest";
import { FULL_SENTENCE, MOODBOARD_LIMIT, NOT_A_REFERENCE, itemFor, itemsFrom, moodboardItemSchema } from "./moodboard";
import { stubCard } from "./sources/stubs";

/**
 * The moodboard (spec F-S1, "Moodboard"): a saved item keeps the source link and the attribution, and third-party
 * pictures are kept as references only. Nothing third-party is stored.
 */

const photo = stubCard("unsplash", "1", {
  title: "A rugby player in navy",
  openUrl: "https://unsplash.test/photos/abc",
  previewUrl: "https://images.unsplash.test/abc.jpg",
  attribution: {
    creator: "Ada Photographer",
    creatorUrl: "https://unsplash.test/@ada",
    provider: "Unsplash",
    providerUrl: "https://unsplash.com",
    notice: "Photo by Ada Photographer on Unsplash",
  },
});

describe("what a saved item holds", () => {
  it("is the address, the preview address and the attribution, in that shape", () => {
    const made = itemFor(photo);
    expect(made).toEqual({
      ok: true,
      item: {
        source: "unsplash",
        title: "A rugby player in navy",
        openUrl: "https://unsplash.test/photos/abc",
        previewUrl: "https://images.unsplash.test/abc.jpg",
        attribution: photo.attribution,
      },
    });
  });

  it("refuses an item whose attribution names no provider or gives no notice", () => {
    const blank = { creator: null, creatorUrl: null, provider: "", providerUrl: null, notice: "" };
    const made = itemFor(photo);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(moodboardItemSchema.safeParse({ ...made.item, attribution: blank }).success).toBe(false);
  });

  it("refuses a card whose preview is not somebody's served address", () => {
    expect(itemFor(stubCard("unsplash", "2", { previewUrl: "" }))).toEqual({ ok: false, reason: NOT_A_REFERENCE });
  });

  it("says why a card cannot be saved when the card itself says so", () => {
    expect(itemFor(stubCard("ai-mood", "3", { unsaveable: "Made up on the spot." }))).toEqual({ ok: false, reason: "Made up on the spot." });
  });

  it("says in one sentence how many a moodboard holds, and the database holds the same number", () => {
    expect(MOODBOARD_LIMIT).toBe(60);
    expect(FULL_SENTENCE).toBe("A moodboard holds 60 items. Remove one to save another.");
  });
});

describe("reading saved items back", () => {
  it("reads a row with its id and the time it was added", () => {
    const made = itemFor(photo);
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    const id = "11111111-1111-4111-8111-111111111111";
    const items = itemsFrom([{ ...made.item, id, addedAt: "2026-11-20T10:00:00Z" }]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ id, addedAt: "2026-11-20T10:00:00Z", source: "unsplash" });
  });

  it("leaves out a row that no longer reads, rather than showing it half-broken", () => {
    expect(itemsFrom([{ source: "unsplash" }, null, 7])).toEqual([]);
  });
});
