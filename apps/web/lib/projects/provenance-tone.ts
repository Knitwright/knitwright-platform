import type { Provenance } from "@/lib/garment";

/**
 * How a value is styled, from where it came from. A person's value is plain ink. A
 * suggestion, from a chart or from the assistant, uses the warn colours. There is no
 * tone for "checked": only a named person signing a design off can earn that, and that
 * record does not exist yet.
 */
export type Tone = "person" | "suggested" | "derived";

const TONES: Readonly<Record<Provenance, Tone>> = {
  "brand-supplied": "person",
  "user-edited": "person",
  "suggested-chart": "suggested",
  "ai-suggested": "suggested",
  "read-from-image": "suggested",
  derived: "derived",
};

export const toneOf = (provenance: Provenance): Tone => TONES[provenance];
