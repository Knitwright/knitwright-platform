/**
 * What to tell the user about the bot check, and whether the form may be sent. The
 * submit button is never disabled: a disabled button explains nothing and cannot be
 * reached by keyboard. Instead the form says what it is waiting for.
 */

type BotCheckInput = Readonly<{
  /** The form's current attempt. */
  attempt: number;
  /** The attempt whose check has passed, or null when there is no usable token. */
  passedAttempt: number | null;
  /** The check could not load or reported an error. */
  failed: boolean;
  /** The user tried to send the form before the check had passed. */
  askedEarly: boolean;
}>;

export type BotCheckStatus = Readonly<{
  ready: boolean;
  tone: "info" | "warn";
  message: string | null;
}>;

const WAITING = "Checking that you are a person. This takes a moment.";
const TOO_EARLY = "The check has not finished yet. Wait a moment, then press the button again.";
const COULD_NOT_LOAD =
  "The check could not load. Refresh the page. If that does not help, turn off content blockers for this site or try another browser.";

export const botCheckStatus = (input: BotCheckInput): BotCheckStatus => {
  if (input.failed) return { ready: false, tone: "warn", message: COULD_NOT_LOAD };
  if (input.passedAttempt === input.attempt) return { ready: true, tone: "info", message: null };
  return input.askedEarly
    ? { ready: false, tone: "warn", message: TOO_EARLY }
    : { ready: false, tone: "info", message: WAITING };
};
