/**
 * The four steps every design goes through on its way to being made: the design itself, the
 * factory file, the committee, and the quote. A design is at the furthest step it has reached,
 * worked out only from what is stored: the file's empty fields, its downloads, its share links
 * and its quote requests.
 */

export const JOURNEY_STEPS = [
  { id: "design", label: "Design" },
  { id: "factory-file", label: "Factory file" },
  { id: "committee", label: "Committee" },
  { id: "quote", label: "Quote" },
] as const;

export type JourneyStepId = (typeof JOURNEY_STEPS)[number]["id"];

export interface DesignProgress {
  /** How many fields of the factory file are empty, or null when that is not known. */
  readonly toConfirm: number | null;
  /** True when the factory file was ever downloaded. */
  readonly downloaded: boolean;
  /** True when a share link was ever made for the design. */
  readonly shared: boolean;
  /** True when a quote was ever asked for. */
  readonly quoted: boolean;
}

export function journeyStep(progress: DesignProgress): JourneyStepId {
  if (progress.quoted) return "quote";
  if (progress.shared) return "committee";
  if (progress.downloaded || progress.toConfirm === 0) return "factory-file";
  return "design";
}

/** Where a step comes in the journey, from 0. */
export const journeyIndex = (step: JourneyStepId): number => JOURNEY_STEPS.findIndex((entry) => entry.id === step);
