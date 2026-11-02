import { CAPTCHA_FIELD } from "@/lib/auth/schemas";
import type { Verdict } from "@/lib/moderation/types";
import { AppError, MESSAGES } from "@/lib/server/core/errors";
import type { RateLimitRule } from "@/lib/server/core/guard";
import { linkRateKey } from "@/lib/share/token";
import type { BotCheckOutcome } from "@/lib/share/turnstile";
import { checkNumber } from "./numbers";
import type { OpenSignup, SubmitInput } from "./service";
import { NAME_ZONE, checkAgainstZones, type ZoneLimit } from "./zones";

/**
 * Taking one player's answer (spec F-T4, plan v5 Z7, decision 0086).
 *
 * The order matters and is the whole point of this file being its own: the bot check first, so a
 * script cannot reach anything; then the link's own limit, so one leaked address cannot flood a
 * season; then the number against the sport's row and the name against the zone's row, so a value
 * that cannot be printed never reaches the database; then moderation (F-G1), so a word we do not
 * print is refused before it is kept; and only then the write.
 *
 * The bot check needs `TURNSTILE_SECRET_KEY`. Without it nothing is taken at all, which is a fact
 * about an environment with no secret, not a fault.
 */

export interface SubmitDeps {
  readonly hitLinkLimit: (key: string, rule: RateLimitRule) => Promise<boolean>;
  readonly botCheck: (request: Readonly<{ secret: string; token: string; address: string }>) => Promise<BotCheckOutcome>;
  readonly secret: string | null;
  readonly address: string;
  readonly rule: RateLimitRule;
  readonly open: (token: string) => Promise<OpenSignup | null>;
  readonly zones: () => Promise<readonly ZoneLimit[]>;
  /** X8's text screen, which records the result and answers with the verdict. */
  readonly screen: (input: Readonly<{ brandId: string; text: string }>) => Promise<Verdict>;
  readonly save: (input: SubmitInput) => Promise<void>;
  readonly visitorKey: string;
}

export interface SubmitForm {
  readonly token: string;
  readonly name: string;
  readonly number: string;
  readonly sizeLabel: string;
  readonly wearerGroup: string;
  readonly [CAPTCHA_FIELD]: string;
}

const TRY_LATER = "We could not take that just now. Try again in a few minutes.";
const LINK_GONE = "That link does not work. Ask the person at your club who sent it to you for a new one.";

/** Refuses a name moderation blocks, in the words moderation itself gave. */
function refuseBlocked(verdict: Verdict): void {
  if (verdict.result !== "blocked") return;
  const first = verdict.reasons.find((reason) => reason.severity === "block");
  const message = first?.message ?? "That name cannot be printed. Choose another.";
  throw new AppError("invalid_input", MESSAGES.invalid_input, { name: [message] });
}

/** The bot check and the link's own limit. Counted only after the bot check passed. */
async function guard(deps: SubmitDeps, form: SubmitForm): Promise<void> {
  if (deps.secret === null) throw new AppError("unavailable", TRY_LATER);
  const outcome = await deps.botCheck({ secret: deps.secret, token: form[CAPTCHA_FIELD], address: deps.address });
  if (outcome === "unreachable") throw new AppError("unavailable", TRY_LATER);
  if (outcome === "failed") {
    throw new AppError("invalid_input", MESSAGES.invalid_input, { [CAPTCHA_FIELD]: ["The check did not pass. Try it again."] });
  }
  if (!(await deps.hitLinkLimit(`${deps.rule.name}:link:${linkRateKey(form.token)}`, deps.rule))) {
    throw new AppError("rate_limited", MESSAGES.rate_limited);
  }
}

export interface Submitted {
  readonly name: string;
  readonly number: string;
  /** What moderation said, so a flagged name can be shown to the club rather than hidden. */
  readonly verdict: Verdict;
  readonly ruleIds: readonly string[];
}

/** Takes a player's answer, or raises the one problem a player can act on. */
export async function takeAnswer(deps: SubmitDeps, form: SubmitForm): Promise<Submitted> {
  await guard(deps, form);
  const opened = await deps.open(form.token);
  if (!opened) throw new AppError("not_found", LINK_GONE);

  const zones = await deps.zones();
  const name = checkAgainstZones(zones, form.name);
  if (!name.ok) throw new AppError("invalid_input", MESSAGES.invalid_input, { name: [name.message] });

  const number = checkNumber(opened.numberRule, form.number);
  if (!number.ok) throw new AppError("invalid_input", MESSAGES.invalid_input, { number: [number.message] });

  const verdict = await deps.screen({ brandId: opened.brandId, text: form.name });
  refuseBlocked(verdict);

  await deps.save({
    token: form.token,
    visitorKey: deps.visitorKey,
    name: form.name,
    number: number.number,
    sizeLabel: form.sizeLabel,
    wearerGroup: form.wearerGroup,
  });
  const zoneRuleId = zones.find((zone) => zone.zone === NAME_ZONE)?.ruleId ?? "R-GAP-000";
  return {
    name: form.name,
    number: number.number,
    verdict,
    ruleIds: [zoneRuleId, opened.numberRule.ruleId, ...verdict.reasons.map((reason) => reason.ruleId)],
  };
}
