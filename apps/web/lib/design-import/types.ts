/** Every value read from a picture has this provenance, a confidence from 0 to 1, and a plain note. */
export const READ_PROVENANCE = "read-from-image" as const;

export interface Staged<T> {
  readonly value: T;
  /** 0 is a guess, 1 is as sure as a reading gets. Never shown as a percentage of being right. */
  readonly confidence: number;
  /** One plain sentence saying what was found, or why not. */
  readonly note: string;
}

export const staged = <T>(value: T, confidence: number, note: string): Staged<T> => ({
  value,
  confidence: Math.max(0, Math.min(1, Math.round(confidence * 100) / 100)),
  note,
});

/** Words for a confidence, so a screen never shows a bare number as if it were a measurement. */
export function confidenceWords(confidence: number): "high" | "medium" | "low" {
  if (confidence >= 0.75) return "high";
  return confidence >= 0.45 ? "medium" : "low";
}
