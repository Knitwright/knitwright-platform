import type { z } from "zod";
import { AppError, MESSAGES, toFailure, type Failure, type FieldErrors } from "./errors";

export type Session = Readonly<{ userId: string; email: string | null }>;

export type RateLimitRule = Readonly<{
  /** Names the bucket. Requests under different names never share a count. */
  name: string;
  limit: number;
  windowSeconds: number;
}>;

export type LogEvent = Readonly<{
  level: "error" | "warn";
  message: string;
  where: string;
  error?: unknown;
}>;

/** Everything a wrapper needs from the outside world, so tests can supply their own. */
export type GuardDeps = Readonly<{
  getSession: () => Promise<Session | null>;
  getClientAddress: () => Promise<string>;
  /** Counts one request against the key. False when the key is over the limit. */
  hitRateLimit: (key: string, rule: RateLimitRule) => Promise<boolean>;
  log: (event: LogEvent) => void;
  /** Rethrows errors the framework uses for control flow, such as a redirect. */
  rethrowControlFlow: (error: unknown) => void;
}>;

export type Auth = "user" | "public";

export type SessionFor<A extends Auth> = A extends "user" ? Session : null;

type Admission<A extends Auth> =
  | Readonly<{ ok: true; session: SessionFor<A> }>
  | Readonly<{ ok: false; failure: Failure }>;

/**
 * Decides whether a request may proceed: session first, then the rate limit. The limit
 * is applied before the input is validated, so invalid requests are counted too.
 */
export const admit = async <A extends Auth>(
  deps: GuardDeps,
  auth: A,
  rule: RateLimitRule,
): Promise<Admission<A>> => {
  const session = auth === "user" ? await deps.getSession() : null;
  if (auth === "user" && !session) {
    return {
      ok: false,
      failure: { code: "unauthenticated", message: MESSAGES.unauthenticated },
    };
  }

  const address = await deps.getClientAddress();
  const keys = [
    `${rule.name}:address:${address}`,
    ...(session ? [`${rule.name}:user:${session.userId}`] : []),
  ];
  for (const key of keys) {
    if (!(await deps.hitRateLimit(key, rule))) {
      return { ok: false, failure: { code: "rate_limited", message: MESSAGES.rate_limited } };
    }
  }

  return { ok: true, session: session as SessionFor<A> };
};

export const fieldErrors = (issues: readonly z.core.$ZodIssue[], prefix = ""): FieldErrors => {
  const grouped = new Map<string, string[]>();
  for (const issue of issues) {
    const path = [prefix, ...issue.path.map(String)].filter(Boolean).join(".") || "(root)";
    grouped.set(path, [...(grouped.get(path) ?? []), issue.message]);
  }
  return Object.fromEntries(grouped);
};

export const invalidInput = (fields: FieldErrors): Failure => ({
  code: "invalid_input",
  message: MESSAGES.invalid_input,
  fields,
});

/** Turns anything a handler threw into a failure that is safe to show. */
export const failureFrom = (deps: GuardDeps, error: unknown, where: string): Failure => {
  deps.rethrowControlFlow(error);
  if (error instanceof AppError && error.code !== "internal") return toFailure(error);
  // The user sees a general message. The log is the only record of what happened.
  deps.log({ level: "error", message: "Unexpected failure in a handler", where, error });
  return { code: "internal", message: MESSAGES.internal };
};
