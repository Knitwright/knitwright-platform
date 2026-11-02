import type { AfterStore, UploadInput } from "./hooks";
import type { TextContext } from "./text";
import type { Verdict } from "./types";

/**
 * THE NARROW PORTS THE REST OF THE PRODUCT IMPORTS FROM MODERATION (H3 of the v5 security review,
 * decision 0116).
 *
 * The spec is one sentence -- "on every upload, every AI generation and before every order"
 * (`docs/spec/02-features.md:948`) -- and three of the four hooks had no production caller at all:
 * one upload path of about eight was wired, no generation path of five, and no order path of two.
 * The machinery was well built and nothing reached it.
 *
 * A path that needs a screen declares one of these types and nothing else, and the route or action
 * binds it with `generationGate`, `orderGate`, `uploadGate` or `humanReviewGate` from `./server.ts`.
 * The brand, the person and the route for the usage meter are bound there, so a calling path cannot
 * get them wrong and cannot reach a model by accident.
 */

/** The one thing the artwork upload path imports from moderation: screen before storing, then keep the result. */
export type UploadGate = (input: UploadInput) => Promise<AfterStore>;

/**
 * `screenGeneration`, bound to the brand and the person. Every path that calls a model for a
 * picture takes one of these and refuses to keep what it blocks. It returns the verdict rather than
 * throwing, because a generation path has money to put right before it answers.
 */
export type GenerationGate = (input: Readonly<{ generationId: string; image: Uint8Array; prompt: string }>) => Promise<Verdict>;

/**
 * `screenBeforeOrder`, bound to the brand and the person. Every path that hands work to a factory
 * takes one of these. It returns the verdict: a blocked order is refused by the caller through
 * `refuseIfBlocked`, and a flagged one sits in the ops review queue.
 */
export type OrderGate = (
  input: Readonly<{
    versionId: string;
    label: string;
    assetIds: readonly string[];
    texts: readonly Readonly<{ text: string; context: TextContext }>[];
    classB: boolean;
  }>,
) => Promise<Verdict>;

/**
 * `assertHumanReviewed`. Throws unless a person has allowed this design version and nothing has
 * been flagged or blocked about it since. A Class B run calls it immediately before the hand-off.
 */
export type HumanReviewGate = (versionId: string) => Promise<void>;
