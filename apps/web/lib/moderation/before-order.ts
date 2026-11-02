import { refuseIfBlocked } from "./hooks";
import type { HumanReviewGate, OrderGate } from "./gate";
import type { TextContext } from "./text";
import type { Verdict } from "./types";

/**
 * THE TWO CALLS EVERY ORDER PATH MAKES BEFORE IT HANDS WORK TO A FACTORY (H3 of the v5 security
 * review, decision 0116).
 *
 * The spec says "before every order" (`docs/spec/02-features.md:948`) and neither order path made
 * either call: `screenBeforeOrder` and `assertHumanReviewed` had no production caller at all. Both
 * paths now go through this one function, so they refuse the same things in the same words and in
 * the same order, and a third order path added later has one obvious thing to call.
 *
 * **The order of the two calls matters.** `moderation_human_allowed` is true only when the newest
 * decision is an allowance and nothing with a higher sequence number is blocked or undecided, so a
 * flag the screen records now correctly invalidates an allowance a person gave earlier. Screening
 * first and asserting second is therefore the only order that cannot let a stale allowance through.
 */

export interface OrderToScreen {
  /**
   * The frozen release being made. It is what `screenBeforeOrder` keeps its result against and what
   * `assertHumanReviewed` asks about, and both order paths already carry it, so the ops reviewer's
   * decision and this check are always about the same thing. See decision 0116 for why the release
   * and not the design version number: a release is a uuid, and it is what a factory is sent.
   */
  readonly releaseId: string;
  /** Plain words for the ops queue: what is being ordered. */
  readonly label: string;
  /** Every uploaded picture the design uses, once each. */
  readonly assetIds: readonly string[];
  /** The words that go out with it. A product title is held to the strictest of the text rules. */
  readonly texts: readonly Readonly<{ text: string; context: TextContext }>[];
  /** True for a Class B run, which the spec says a person looks at before it starts (F-G1). */
  readonly classB: boolean;
}

/**
 * Screens a design before an order and, for a Class B run, refuses until a person has allowed it.
 *
 * A blocked verdict throws, so a caller cannot forget to look. A flagged one comes back: the order
 * goes, and the flag sits in the ops review queue. The verdict is returned rather than swallowed so
 * a caller can tell a person what is waiting.
 */
export async function guardOrder(
  gates: Readonly<{ order: OrderGate; humanReview: HumanReviewGate }>,
  input: OrderToScreen,
): Promise<Verdict> {
  const verdict = await gates.order({
    versionId: input.releaseId,
    label: input.label,
    assetIds: input.assetIds,
    texts: input.texts,
    classB: input.classB,
  });
  refuseIfBlocked(verdict, "design");
  if (input.classB) await gates.humanReview(input.releaseId);
  return verdict;
}

/** Both gates together: what an action binds once and hands to `guardOrder`. */
export type OrderGuards = Readonly<{ order: OrderGate; humanReview: HumanReviewGate }>;
