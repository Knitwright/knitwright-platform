import type { z } from "zod";
import type { UsageMeter } from "@/lib/usage/meter";
import { AppError, MESSAGES, toFailure, type Failure, type FieldErrors } from "./errors";

export type Session = Readonly<{ userId: string; email: string | null }>;

export type BrandRole = "owner";

/** The brand a member is working in. Every design, file and image belongs to one. */
export type Brand = Readonly<{ id: string; name: string; role: BrandRole }>;

export type MemberSession = Session & Readonly<{ brand: Brand }>;

export type RateLimitRule = Readonly<{
  /** Names the bucket. Requests under different names never share a count. */
  name: string;
  limit: number;
  windowSeconds: number;
}>;

export type LogEvent = Readonly<{
  level: "error" | "warn" | "info";
  message: string;
  where: string;
  error?: unknown;
}>;

/** Everything a wrapper needs from the outside world, so tests can supply their own. */
export type GuardDeps = Readonly<{
  getSession: () => Promise<Session | null>;
  /** The brand the user is working in, after confirming they belong to it. */
  getActiveBrand: (session: Session) => Promise<Brand | null>;
  getClientAddress: () => Promise<string>;
  /** Counts one request against the key. False when the key is over the limit. */
  hitRateLimit: (key: string, rule: RateLimitRule) => Promise<boolean>;
  log: (event: LogEvent) => void;
  /** Reserves the cost of paid AI calls, and gives it back when a call fails. */
  usage: UsageMeter;
  /** Rethrows errors the framework uses for control flow, such as a redirect. */
  rethrowControlFlow: (error: unknown) => void;
}>;

/**
 * "member" needs a session and a brand the user belongs to. "user" needs a session
 * only, for the few things done before a brand exists. "public" needs neither.
 */
export type Auth = "member" | "user" | "public";

export type SessionFor<A extends Auth> = A extends "member"
  ? MemberSession
  : A extends "user"
    ? Session
    : null;

type Admission<A extends Auth> =
  | Readonly<{ ok: true; session: SessionFor<A> }>
  | Readonly<{ ok: false; failure: Failure }>;

const refuse = (code: "unauthenticated" | "no_brand" | "rate_limited") =>
  ({ ok: false, failure: { code, message: MESSAGES[code] } }) as const;

/**
 * Decides whether a request may proceed: session first, then the brand, then the rate
 * limit. The limit is applied before the input is validated, so invalid requests are
 * counted too.
 */
export const admit = async <A extends Auth>(
  deps: GuardDeps,
  auth: A,
  rule: RateLimitRule,
): Promise<Admission<A>> => {
  const session = auth === "public" ? null : await deps.getSession();
  if (auth !== "public" && !session) return refuse("unauthenticated");

  const brand = auth === "member" && session ? await deps.getActiveBrand(session) : null;
  if (auth === "member" && !brand) return refuse("no_brand");

  const address = await deps.getClientAddress();
  const keys = [
    `${rule.name}:address:${address}`,
    ...(session ? [`${rule.name}:user:${session.userId}`] : []),
  ];
  for (const key of keys) {
    if (!(await deps.hitRateLimit(key, rule))) return refuse("rate_limited");
  }

  const admitted = session && brand ? { ...session, brand } : session;
  return { ok: true, session: admitted as SessionFor<A> };
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
