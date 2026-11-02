import { describe, expect, it } from "vitest";
import { VOICE_TAGS as BRAND_STUDIO_TAGS } from "@/lib/brand-studio/words";
import { finishedRecord, record } from "@/lib/brand-studio/fixtures/brand";
import { VOICE_TAGS, hasVoice, voiceFromRecord, voiceWords } from "./voice";

/**
 * Brand Studio (Y6, decision 0079) merged while this branch was in flight, so the voice tags are
 * its own list and this is the one adapter from its record to what "Write for me" needs.
 */

describe("the voice tags", () => {
  it("are Brand Studio's own list, not a second copy of it", () => {
    expect(VOICE_TAGS).toBe(BRAND_STUDIO_TAGS);
  });
});

describe("the brand's voice from Brand Studio's record", () => {
  it("takes the name, the tags, the brand's own words and the three type styles", () => {
    const voice = voiceFromRecord(finishedRecord());

    expect(voice).toEqual({
      brandId: "22222222-2222-4222-8222-222222222222",
      name: "Test FC",
      tags: ["community"],
      about: "A club in the north.",
      styles: { headline: "geist", subheadline: "geist", body: "geist" },
    });
    expect(voiceWords(voice)).toBe("Community");
    expect(hasVoice(voice)).toBe(true);
  });

  it("says a brand that has filled nothing in has no voice, rather than guessing one", () => {
    const voice = voiceFromRecord(record());

    expect(voice.tags).toEqual([]);
    expect(voice.about).toBeNull();
    expect(voice.styles).toBeNull();
    expect(hasVoice(voice)).toBe(false);
  });

  it("leaves the styles out unless all three roles have a font on file", () => {
    const some = voiceFromRecord(record({ fonts: [{ role: "headline", fontKey: "geist" }, { role: "body", fontKey: "geist" }] }));
    expect(some.styles).toBeNull();

    const none = voiceFromRecord(record({ fonts: [{ role: "headline", fontKey: null }, { role: "subheadline", fontKey: "geist" }, { role: "body", fontKey: "geist" }] }));
    expect(none.styles).toBeNull();
  });

  it("takes words that are only spaces as no words at all", () => {
    const voice = voiceFromRecord(record({ profile: { ...record().profile, about: "   " } }));
    expect(voice.about).toBeNull();
  });
});
