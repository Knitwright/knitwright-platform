import type { TranslationKey } from "./keys";
import type { Language } from "./languages";

/**
 * The seam to a translation service (plan v5 rule: "No live paid call from tests or your own run").
 *
 * No service is wired in. This is the smallest interface one would sit behind, with a stub that says it
 * is not available, so the code that would use it exists and is tested without anything being called and
 * without a key being needed. When a service is wired in, two things hold whatever it returns:
 *
 *   1. Its output is never marked as reviewed. `machine` is true on every row it produces and the
 *      database refuses a machine row that claims a reviewer, so a service's words reach a factory only
 *      as an unreviewed draft, labelled on every page.
 *   2. Its output is a proposal for a row, never a row. A person with the right to write settings puts
 *      it in the library, and a person who reads the language puts their name against it.
 */

export interface TranslationRequest {
  readonly key: TranslationKey;
  readonly text: string;
  readonly from: Language;
  readonly to: Language;
}

/** What a service proposes for one key. It is never reviewed and always says who produced it. */
export interface TranslationProposal {
  readonly key: TranslationKey;
  readonly language: Language;
  readonly text: string;
  readonly translatedBy: string;
  /** Always true: these words came from a machine. */
  readonly machine: true;
  /** Always null: a service never reviews its own work (decision 0103). */
  readonly reviewedBy: null;
  readonly label: string;
}

export type TranslationOutcome =
  | Readonly<{ status: "proposed"; proposals: readonly TranslationProposal[] }>
  | Readonly<{ status: "not-available"; reason: string }>;

export interface TranslationService {
  /** The name a proposal is filed under, so a row says which service produced it. */
  readonly name: string;
  translate(requests: readonly TranslationRequest[]): Promise<TranslationOutcome>;
}

export const NOT_AVAILABLE =
  "No translation service is wired in. The words in the library are the only ones a document can be set in.";

/** The service the platform runs on today: there is none, and it says so rather than returning words. */
export const unavailableTranslationService: TranslationService = {
  name: "none",
  translate: async () => ({ status: "not-available", reason: NOT_AVAILABLE }),
};

/**
 * A stub for a test: it gives back the text it was given, marked as a machine translation that nobody has
 * reviewed. Deterministic, calls nothing, and is never wired into a page — its only job is to prove that
 * what a service produces cannot reach a factory as a reviewed translation.
 */
export const stubTranslationService = (name = "stub"): TranslationService => ({
  name,
  translate: async (requests) => ({
    status: "proposed",
    proposals: requests.map((request) => ({
      key: request.key,
      language: request.to,
      text: request.text,
      translatedBy: name,
      machine: true,
      reviewedBy: null,
      label: `Machine translation by ${name}. Nobody has read it against the ${request.from} words.`,
    })),
  }),
});
