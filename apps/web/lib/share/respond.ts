import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { RateLimitRule } from "@/lib/server/core/guard";
import { LIMITS } from "@/lib/server/limits";
import type { ShareResponseInput } from "./schemas";
import type { ShareAnswerInput } from "./service";
import type { BotCheckOutcome } from "./turnstile";
import { linkRateKey } from "./token";

/**
 * Keeping a visitor's answer from a share page. The wrapper has already limited the visitor's
 * address. This checks the bot check, then limits the link as well, so many addresses cannot flood
 * one design, then keeps the answer under the key in the visitor's cookie.
 */

export interface RespondDeps {
  readonly hitLinkLimit: (key: string, rule: RateLimitRule) => Promise<boolean>;
  readonly botCheck: (request: Readonly<{ secret: string; token: string; address: string }>) => Promise<BotCheckOutcome>;
  /** The Turnstile secret, or null where none is set and answers are refused. */
  readonly secret: string | null;
  readonly address: string;
  readonly visitorKey: string;
  readonly save: (answer: ShareAnswerInput) => Promise<void>;
}

const TRY_LATER = "We could not take answers just now. Try again in a few minutes.";

export async function keepAnswer(deps: RespondDeps, input: ShareResponseInput): Promise<void> {
  if (deps.secret === null) throw new AppError("unavailable", TRY_LATER);
  const outcome = await deps.botCheck({ secret: deps.secret, token: input[CAPTCHA_FIELD], address: deps.address });
  if (outcome === "unreachable") throw new AppError("unavailable", TRY_LATER);
  if (outcome === "failed") {
    throw new AppError("invalid_input", MESSAGES.invalid_input, { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] });
  }
  // Counted only after the bot check passed, so failed attempts cannot use up a link's answers.
  const rule = LIMITS.shareRespondLink;
  if (!(await deps.hitLinkLimit(`${rule.name}:link:${linkRateKey(input.token)}`, rule))) {
    throw new AppError("rate_limited", MESSAGES.rate_limited);
  }
  await deps.save({ token: input.token, visitorKey: deps.visitorKey, name: input.name, vote: input.vote, comment: input.comment });
}
