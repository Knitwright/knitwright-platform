import type { LogEvent } from "./core/guard";

/**
 * Server log. One line of JSON per event, which the host collects. Errors also go to error
 * monitoring when MONITORING_DSN is set: see lib/monitoring and `productionDeps`.
 */

const MAX_CAUSES = 5;

/** Keys and tokens that must never reach a log, whatever message carried them. */
const SECRETS = [
  /sb_(?:secret|publishable)_[A-Za-z0-9_-]+/g,
  /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  /(?:postgres|postgresql):\/\/[^\s"']+/g,
  // AI provider keys (Anthropic, OpenAI).
  /sk-ant-[A-Za-z0-9_-]+/g,
  /sk-(?:proj-)?[A-Za-z0-9_-]{20,}/g,
];

/** The token in a share link's address (decision 0026). The path stays, so the log still says what was asked for. */
const SHARE_TOKEN = /(\/s\/)[A-Za-z0-9_-]{43}/g;

/** The token in a factory's job packet address, page or download (decision 0072). */
const JOB_TOKEN = /(\/job\/)[A-Za-z0-9_-]{43}/g;

/**
 * The token in a roster sign-up address (plan v5 Z7, decision 0087). The same rule as a share
 * link: whoever holds it can read the club's season and write a player's name, and with the name
 * the phone number and address the manager gave. It was the one token page left out of here.
 */
const SIGNUP_TOKEN = /(\/join\/)[A-Za-z0-9_-]{43}/g;

/** Values that follow a telling name. The name stays, so the log still says what was there. */
const LABELLED = /\b(Bearer\s+|(?:token_hash|access_token|refresh_token|code)=)[^\s&"',;]+/g;

/**
 * Removes keys and tokens from text that leaves the server: the log, and error monitoring.
 *
 * **The specific patterns run before the generic ones, and the order is load-bearing.** A share, job
 * or sign-up token is 43 characters of base64url, so about one in thirteen thousand contains `sk-`
 * followed by twenty more — and the generic provider-key pattern would eat that tail, leaving a
 * fragment the `/s/`, `/job/` and `/join/` patterns no longer match. The token still did not reach the log, so
 * nothing leaked; what broke was the path, and with it the only part of the line that says what was
 * asked for. It surfaced as `job-packet/headers.test.ts` failing about once in thirteen thousand
 * runs with a random token, which is exactly how long it takes to find a bug like this by accident.
 *
 * Every pattern still runs, so nothing redacted before is redacted less now.
 */
export const scrub = (text: string): string =>
  SECRETS.reduce(
    (cleaned, pattern) => cleaned.replace(pattern, "[removed]"),
    text.replace(SHARE_TOKEN, "$1[removed]").replace(JOB_TOKEN, "$1[removed]").replace(SIGNUP_TOKEN, "$1[removed]"),
  ).replace(LABELLED, "$1[removed]");

type Described = Readonly<Record<string, unknown>>;

/**
 * The fields a thrown object that is not an Error may carry, such as a database error from
 * Supabase. Only these are kept, so nothing else the object holds can reach the log. Postgres `details` is left out on
 * purpose: it echoes row values ("Key (email)=(...)").
 */
const KNOWN_FIELDS = ["code", "message", "hint", "status", "name"] as const;

const describeObject = (value: object): Described =>
  Object.fromEntries(
    KNOWN_FIELDS.filter((field) => field in value).map((field) => {
      const held: unknown = (value as Record<string, unknown>)[field];
      return [field, typeof held === "string" ? scrub(held) : held];
    }),
  );

const describe = (error: unknown, depth = 0): Described => {
  if (!(error instanceof Error)) {
    return typeof error === "object" && error !== null ? describeObject(error) : { value: scrub(String(error)) };
  }
  const base = {
    name: error.name,
    message: scrub(error.message),
    stack: error.stack ? scrub(error.stack) : undefined,
  };
  return error.cause !== undefined && depth < MAX_CAUSES
    ? { ...base, cause: describe(error.cause, depth + 1) }
    : base;
};

export const formatLogEvent = (event: LogEvent): string =>
  JSON.stringify({
    time: new Date().toISOString(),
    level: event.level,
    message: event.message,
    where: event.where,
    ...(event.error === undefined ? {} : { error: describe(event.error) }),
  });

export const log = (event: LogEvent): void => {
  const line = `${formatLogEvent(event)}\n`;
  if (event.level === "error") process.stderr.write(line);
  else process.stdout.write(line);
};
