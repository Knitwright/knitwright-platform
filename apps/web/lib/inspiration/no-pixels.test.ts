import { describe, expect, it } from "vitest";
import { applyAction } from "@/lib/garment";
import { previewDiff } from "@/lib/design-diff/preview";
import { designDiffSchema, type DesignDiff } from "@/lib/design-diff/diff";
import { defaultFactoryProfile } from "@/lib/validation";
import { validateDesign } from "@/lib/validation/validate";
import { standardRegistry } from "@/lib/validation/spec-input";
import { jersey, withCrest, withPattern } from "./fixtures/designs";
import { itemFor, moodboardItemSchema } from "./moodboard";
import { isSuggestionDiff, pictureRefsOf, pixelBreach } from "./no-pixels";
import { moodCard } from "./sources/ai-mood";
import { stubCard } from "./sources/stubs";
import { suggestFromCard } from "./suggest/suggest";
import { stubElementReader, type TransferableElements } from "./suggest/elements";
import { SUGGESTION_DIFF_KINDS } from "./suggest/to-diffs";
import type { ContextQuery } from "./types";
import { CARD_SOURCES } from "./vocabulary";

/**
 * **The test plan v5 Z1 names: no inspiration image can reach a panel layer or a print file.**
 *
 * Spec F-S1's acceptance says "No third-party image is ever written to a panel layer or a print file", and spec
 * decision 13 says AI never draws the garment. The board holds pictures from six sources, one of them a model's own
 * output, and it would be enough for one road from a card to a layer to exist for the rule to be broken. The three
 * roads a picture could take are closed here, and each is closed by construction rather than by a check that could be
 * forgotten:
 *
 *  1. a suggestion is one of three design diffs, none of which can name a file, an asset or an address;
 *  2. a moodboard item has no field a picture could sit in, and its addresses must be somebody else's https address;
 *  3. an AI mood image is never stored, so there is no address a layer could ever point at.
 *
 * A print file is drawn from the stored design object (`lib/print`), so a design whose pictures cannot change is a
 * print file whose pictures cannot change: the first road is the one that matters, and it is the one shut hardest.
 */

const profile = defaultFactoryProfile();
const check = async () => validateDesign({ typeId: "team-jersey", readiness: null }, profile, standardRegistry());

const query: ContextQuery = { tags: [{ text: "navy", kind: "colour" }], text: "navy", removed: [] };

/** A model that tries every way there is of getting a picture onto the garment. */
const HOSTILE: TransferableElements = {
  patternFamily: "fade",
  colourRoles: [
    { panel: "body front", colour: "navy" },
    // A panel this base does not have, named to see whether anything is invented for it.
    { panel: "https://evil.test/picture.png", colour: "gold" },
  ],
  options: [{ group: "fit", choice: "slim" }],
  notTransferable: ["the photograph itself as a print", "a welded zip", "the brand's wordmark"],
};

describe("the three diff kinds a suggestion may use", () => {
  it("are colour, pattern style and option, and never a picture move", () => {
    expect([...SUGGESTION_DIFF_KINDS]).toEqual(["set-colour", "swap-style", "change-option"]);
    expect(isSuggestionDiff({ kind: "move-placement", artworkId: "crest", direction: "up" })).toBe(false);
  });

  it("have no field in their format that could name a file, an asset or an address", () => {
    // The format itself is the proof: every field of the three kinds is a panel id, a colour, a style or a choice.
    for (const kind of SUGGESTION_DIFF_KINDS) {
      const shape = designDiffSchema.options.find((option) => option.shape.kind.value === kind);
      const fields = Object.keys(shape?.shape ?? {});
      expect(fields.join(" "), kind).not.toMatch(/file|asset|url|image|picture|src|href/i);
    }
  });

  it("refuses a diff of any other kind, whatever else is true of it", () => {
    const moved: DesignDiff = { kind: "move-placement", artworkId: "crest", direction: "down" };
    const before = withCrest();
    const after = previewDiff(before, moved, profile);
    expect(after.ok).toBe(true);
    expect(pixelBreach(before, after.ok ? after.after : before, moved)).toEqual({
      reason: 'A suggestion from an inspiration card can never be a "move-placement" change.',
    });
  });
});

describe("a suggestion from a card of any source", () => {
  it("never changes which pictures the design uses, however hard the model tries", async () => {
    const before = withCrest();
    const was = pictureRefsOf(before);
    expect(was).toEqual(["artwork:11111111-1111-4111-8111-111111111111"]);

    for (const source of CARD_SOURCES) {
      const card = source === "ai-mood" ? moodCard(query, "data:image/png;base64,AAAA") : stubCard(source, "1");
      const made = await suggestFromCard(before, card, { reader: stubElementReader([HOSTILE]), profile, check });
      expect(made.suggestions.length, source).toBeGreaterThan(0);
      let spec = before;
      for (const suggestion of made.suggestions) {
        expect(isSuggestionDiff(suggestion.diff), `${source} ${suggestion.diff.kind}`).toBe(true);
        const preview = previewDiff(spec, suggestion.diff, profile);
        if (!preview.ok) continue;
        expect(pixelBreach(spec, preview.after, suggestion.diff), source).toBeNull();
        spec = preview.after;
      }
      // Every suggestion of that card applied, one after another: the same pictures, in the same order.
      expect(pictureRefsOf(spec), source).toEqual(was);
      expect(spec.artwork.map((art) => art.source), source).toEqual(before.artwork.map((art) => art.source));
    }
  });

  it("says plainly what it cannot do rather than finding another way to do it", async () => {
    const made = await suggestFromCard(withPattern(), stubCard("unsplash", "2"), { reader: stubElementReader([HOSTILE]), profile, check });
    expect(made.notPossible.join(" ")).toContain("the photograph itself as a print is not something this base article can do");
    expect(made.notPossible.join(" ")).toContain("a welded zip");
    expect(made.suggestions.every((entry) => isSuggestionDiff(entry.diff))).toBe(true);
  });

  it("adds no layer to the artwork stack", async () => {
    const before = withPattern();
    const made = await suggestFromCard(before, stubCard("pexels", "3"), { reader: stubElementReader([HOSTILE]), profile, check });
    for (const suggestion of made.suggestions) {
      const preview = previewDiff(before, suggestion.diff, profile);
      if (!preview.ok) continue;
      expect(preview.after.artworkStack?.layers.length ?? 0).toBe(before.artworkStack?.layers.length ?? 0);
    }
  });
});

describe("the guard that watches the applied change", () => {
  it("catches a picture added by any other road", () => {
    const before = withPattern();
    const after = applyAction(before, {
      type: "add-artwork",
      artwork: {
        id: "smuggled",
        name: "A borrowed photograph",
        source: { kind: "file", fileId: "22222222-2222-4222-8222-222222222222" },
        panelId: "body-front",
        anchor: "centre-chest",
        offsetX: 0,
        offsetY: 0,
        width: 500,
        height: 500,
        rotationDegrees: 0,
        technique: "sublimation",
        provenance: "ai-suggested",
      },
    });
    expect(after.ok).toBe(true);
    if (!after.ok) return;
    expect(pixelBreach(before, after.spec, { kind: "swap-style", style: "fade" })).toEqual({
      reason: "A suggestion from an inspiration card can never change which pictures a design uses.",
    });
  });

  it("lets a colour, a style and an option change through", () => {
    const before = withPattern();
    const diffs: DesignDiff[] = [
      { kind: "set-colour", panels: ["body-front"], colour: "navy" },
      { kind: "swap-style", style: "fade" },
      { kind: "change-option", optionId: "fit", choiceId: "slim" },
    ];
    for (const diff of diffs) {
      const preview = previewDiff(before, diff, profile);
      expect(preview.ok, diff.kind).toBe(true);
      if (preview.ok) expect(pixelBreach(before, preview.after, diff), diff.kind).toBeNull();
    }
  });

  it("reads every road a picture takes into the stored design", () => {
    expect(pictureRefsOf(jersey())).toEqual([]);
    expect(pictureRefsOf(withCrest("33333333-3333-4333-8333-333333333333"))).toEqual(["artwork:33333333-3333-4333-8333-333333333333"]);
  });
});

describe("nothing third-party is stored", () => {
  it("refuses a picture carried in an address, whatever the scheme", () => {
    for (const url of ["data:image/png;base64,AAAA", "blob:https://knitwright.test/abc", "file:///etc/passwd", "http://plain.test/a.png"]) {
      const parsed = moodboardItemSchema.safeParse({
        source: "unsplash",
        title: "A photo",
        openUrl: url,
        previewUrl: "https://images.unsplash.test/a.jpg",
        attribution: { creator: null, creatorUrl: null, provider: "Unsplash", providerUrl: null, notice: "Photo by A on Unsplash" },
      });
      expect(parsed.success, url).toBe(false);
    }
  });

  it("has no field a picture's bytes could sit in, and refuses one that is added", () => {
    const fields = Object.keys(moodboardItemSchema.shape);
    expect(fields).toEqual(["source", "title", "openUrl", "previewUrl", "attribution"]);
    const withBytes = {
      source: "unsplash",
      title: "A photo",
      openUrl: "https://unsplash.test/photos/1",
      previewUrl: "https://images.unsplash.test/a.jpg",
      attribution: { creator: null, creatorUrl: null, provider: "Unsplash", providerUrl: null, notice: "Photo by A on Unsplash" },
      bytes: "AAAA",
    };
    expect(moodboardItemSchema.safeParse(withBytes).success).toBe(false);
  });

  it("never saves an AI mood image, because there is no address to save", () => {
    const made = itemFor(moodCard(query, "data:image/png;base64,AAAA"));
    expect(made).toEqual({ ok: false, reason: "An AI mood image is not stored, so it cannot be saved to a moodboard. Make it again from the same tags." });
  });

  it("saves a stock photo as its address, its preview and its attribution, and nothing else", () => {
    const made = itemFor(stubCard("unsplash", "9", { previewUrl: "https://images.unsplash.test/9.jpg", openUrl: "https://unsplash.test/photos/9" }));
    expect(made.ok).toBe(true);
    if (!made.ok) return;
    expect(Object.keys(made.item).sort()).toEqual(["attribution", "openUrl", "previewUrl", "source", "title"]);
  });
});
