import type { LogEvent } from "./core/guard";

/**
 * Server log. One line of JSON per event, which the host collects. Error monitoring is
 * added in step 26; until then this is the only record of an unexpected failure.
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

const scrub = (text: string): string =>
  SECRETS.reduce((cleaned, pattern) => cleaned.replace(pattern, "[removed]"), text);

type Described = Readonly<Record<string, unknown>>;

const describe = (error: unknown, depth = 0): Described => {
  if (!(error instanceof Error)) return { value: scrub(String(error)) };
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
