/**
 * THE BRAND'S VOICE, AS THE SMALLEST INTERFACE (plan v5 lesson 9; L4, decision 0094).
 *
 * "Write for me" writes in the brand's voice and tone (spec F-L2), which Brand Studio keeps:
 * "Voice and tone: tags such as Bold, Gritty, Community, Premium or Playful, used by 'Write for me'
 * copy" (F-S9), and type styles by role (Headline, Subheadline, Body, Accent).
 *
 * Brand Studio is workstream Y6 and `lib/brand-studio` is not in `main` yet, so this workstream
 * depends on an interface of its own with a test double, as the plan's lesson 9 says, rather than
 * importing a directory that does not exist or inventing a brand table. When Y6 lands, one adapter
 * implements `BrandVoiceSource` and nothing else here changes.
 *
 * The five tags are the spec's own words. None is invented, and a brand with no tags on file is a
 * brand this panel says has no voice on file yet -- it never guesses one.
 */

export const VOICE_TAGS = ["bold", "gritty", "community", "premium", "playful"] as const;
export type VoiceTag = (typeof VOICE_TAGS)[number];

export const VOICE_TAG_LABELS: Readonly<Record<VoiceTag, string>> = {
  bold: "Bold",
  gritty: "Gritty",
  community: "Community",
  premium: "Premium",
  playful: "Playful",
};

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

/** A voice source for tests and for the panel while Y6 is not merged: it reads from what it was given. */
export function stubVoiceSource(voices: readonly BrandVoice[]): BrandVoiceSource {
  return { read: async (brandId) => voices.find((voice) => voice.brandId === brandId) ?? null };
}
