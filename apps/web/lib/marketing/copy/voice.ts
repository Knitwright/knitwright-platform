import type { BrandRecord } from "@/lib/brand-studio/types";
import { VOICE_TAGS, VOICE_TAG_LABELS, type FontRole, type VoiceTag } from "@/lib/brand-studio/words";

/**
 * THE BRAND'S VOICE, AS THIS WORKSTREAM NEEDS IT (plan v5 lesson 9; L4, decision 0094).
 *
 * "Write for me" writes in the brand's voice and tone (spec F-L2), which Brand Studio keeps:
 * "Voice and tone: tags such as Bold, Gritty, Community, Premium or Playful, used by 'Write for me'
 * copy" (F-S9), and fonts by role (Headline, Subheadline, Body, Accent, Name & number).
 *
 * **The vocabulary is Brand Studio's own** (`lib/brand-studio/words.ts`, Y6 decision 0079), which
 * merged into `main` while this branch was in flight: the five tags are re-exported from there
 * rather than written out twice, so the platform has one list of voice tags. What is here is only
 * what this workstream needs of a brand -- its name, its tags, its own words and its type styles --
 * and `voiceFromRecord` is the one adapter from Brand Studio's record to it.
 *
 * `BrandVoiceSource` stays an interface with a test double, so the writer and its tests need no
 * database (plan lesson 9). A brand with no tags on file is a brand this panel says has no voice on
 * file yet -- it never guesses one.
 */

export { VOICE_TAGS, VOICE_TAG_LABELS };
export type { VoiceTag };

/** The brand's type styles by role (spec F-S9 "Fonts by role"). A name, never a font file. */
export interface BrandTypeStyles {
  readonly headline: string;
  readonly subheadline: string;
  readonly body: string;
}

/** What this workstream needs to know about a brand, and nothing more. */
export interface BrandVoice {
  readonly brandId: string;
  readonly name: string;
  readonly tags: readonly VoiceTag[];
  /** The brand's own "about" words, which say what it is. Null when none is on file. */
  readonly about: string | null;
  /** The type styles the text slots are set in, or null when the brand has none on file. */
  readonly styles: BrandTypeStyles | null;
}

/** Where a brand's voice is read from. Y6 will implement it; `stubVoiceSource` stands in meanwhile. */
export interface BrandVoiceSource {
  read(brandId: string): Promise<BrandVoice | null>;
}

/** Said when a brand has no voice tags on file. Nothing is written in a voice nobody chose. */
export const NO_VOICE_NOTE = "This brand has no voice and tone on file yet, so nothing has been written for it.";

/** Said beside the brand's own styles while Brand Studio has none on file. */
export const NO_STYLES_NOTE = "No brand type styles on file yet, so the layout's own styles are used.";

/** The tags in a sentence, as the panel and the instructions both say them: "Bold, Community". */
export const voiceWords = (voice: BrandVoice): string => voice.tags.map((tag) => VOICE_TAG_LABELS[tag]).join(", ");

/** True when there is a voice to write in at all. */
export const hasVoice = (voice: BrandVoice | null): voice is BrandVoice => voice !== null && voice.tags.length > 0;

const isTag = (value: string): value is VoiceTag => (VOICE_TAGS as readonly string[]).includes(value);

/** The tags a stored row names, keeping only the ones the spec lists, in the spec's order. */
export const voiceTagsOf = (values: readonly string[]): readonly VoiceTag[] =>
  VOICE_TAGS.filter((tag) => values.map((value) => value.trim().toLowerCase()).some((value) => isTag(value) && value === tag));

/**
 * The brand's voice from Brand Studio's own record. The styles are the fonts chosen for the three
 * roles a marketing layout sets text in; unless all three are on file the styles are left out
 * altogether, and the panel then says the layout's own styles are used.
 */
export function voiceFromRecord(record: BrandRecord): BrandVoice {
  const fontFor = (role: FontRole): string | null => record.fonts.find((font) => font.role === role)?.fontKey ?? null;
  const [headline, subheadline, body] = [fontFor("headline"), fontFor("subheadline"), fontFor("body")];
  const about = record.profile.about.trim();
  return {
    brandId: record.brandId,
    name: record.brandName,
    tags: record.profile.voiceTags,
    about: about === "" ? null : about,
    styles: headline !== null && subheadline !== null && body !== null ? { headline, subheadline, body } : null,
  };
}

/** A voice source for tests and for a panel with no brand read yet: it reads from what it was given. */
export function stubVoiceSource(voices: readonly BrandVoice[]): BrandVoiceSource {
  return { read: async (brandId) => voices.find((voice) => voice.brandId === brandId) ?? null };
}
