import { z } from "zod";

/**
 * Where a value came from. Every measurement carries exactly one of these.
 * There is no "verified" value. A person signing a design off is a separate record.
 */
export const PROVENANCE_VALUES = [
  "brand-supplied",
  "user-edited",
  "suggested-chart",
  "ai-suggested",
  "read-from-image",
  "derived",
] as const;

export const provenanceSchema = z.enum(PROVENANCE_VALUES);

export type Provenance = z.output<typeof provenanceSchema>;

/** Plain words for each value, for screens and documents. */
export const PROVENANCE_LABELS: Readonly<Record<Provenance, string>> = {
  "brand-supplied": "Supplied by your brand",
  "user-edited": "Typed in by you",
  "suggested-chart": "Suggested from a size chart",
  "ai-suggested": "Suggested by the assistant",
  "read-from-image": "Read from a picture",
  derived: "Worked out from other values",
};
