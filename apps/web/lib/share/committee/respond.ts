import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { RateLimitRule } from "@/lib/server/core/guard";
import type { BotCheckOutcome } from "../turnstile";
import { linkRateKey } from "../token";

/**
 * Taking a committee's comment, vote or approval (spec F-T3, plan v5 Z7, decision 0087).
 *
 * The same shape as a share answer (`lib/share/respond.ts`, decision 0026) and for the same
 * reasons: the wrapper has already limited the visitor's address, this checks the bot check, then
 * limits the link as well so many addresses cannot flood one design, and only then writes. The bot
 * check needs `TURNSTILE_SECRET_KEY`; without it nothing is taken at all.
 */

export interface CommitteeWriteDeps {
  readonly hitLinkLimit: (key: string, rule: RateLimitRule) => Promise<boolean>;
  readonly botCheck: (request: Readonly<{ secret: string; token: string; address: string }>) => Promise<BotCheckOutcome>;
  /** The Turnstile secret, or null where none is set and nothing is taken. */
  readonly secret: string | null;
  readonly address: string;
  readonly rule: RateLimitRule;
}

const TRY_LATER = "We could not take that just now. Try again in a few minutes.";

/** What the committee's forms all send: the link's token and the bot check's answer. */
type Guarded = Readonly<{ token: string } & Record<typeof CAPTCHA_FIELD, string>>;

/**
 * Checks the bot check and the link's own limit, then runs the write. The write is handed in, so
 * one guard serves the pin, the vote and the approval and none of them can forget a step.
 */
export async function guardCommitteeWrite<T>(deps: CommitteeWriteDeps, input: Guarded, write: () => Promise<T>): Promise<T> {
  if (deps.secret === null) throw new AppError("unavailable", TRY_LATER);
  const outcome = await deps.botCheck({ secret: deps.secret, token: input[CAPTCHA_FIELD], address: deps.address });
  if (outcome === "unreachable") throw new AppError("unavailable", TRY_LATER);
  if (outcome === "failed") {
    throw new AppError("invalid_input", MESSAGES.invalid_input, { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] });
  }
  // Counted only after the bot check passed, so failed attempts cannot use up a link's allowance.
  if (!(await deps.hitLinkLimit(`${deps.rule.name}:link:${linkRateKey(input.token)}`, deps.rule))) {
    throw new AppError("rate_limited", MESSAGES.rate_limited);
  }
  return write();
}
