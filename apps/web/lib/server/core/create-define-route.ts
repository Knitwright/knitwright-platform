import type { z } from "zod";
import { FAILURE_STATUS, type Failure, type FieldErrors, type Result } from "./errors";
import {
  admit,
  failureFrom,
  fieldErrors,
  invalidInput,
  type Auth,
  type GuardDeps,
  type MemberSession,
  type RateLimitRule,
  type SessionFor,
} from "./guard";
import { costOf, runMetered, type RouteCost } from "./metered";
import { readForm, readJson, type BodyRead } from "./request-body";

const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export type RouteSchemas = Readonly<{
  params?: z.ZodType;
  query?: z.ZodType;
  /** A JSON body. */
  body?: z.ZodType;
  /** A form that may carry files. Used for uploads. */
  form?: z.ZodType;
}>;

type InputOf<S extends RouteSchemas> = {
  readonly [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

export type RouteConfig<A extends Auth, S extends RouteSchemas, T> = Readonly<{
  /** "public" routes must also be listed in lib/server/public-routes.ts. */
  auth: A;
  rateLimit: RateLimitRule;
  schema: S;
  /** Largest body or form accepted, in bytes. */
  maxBodyBytes?: number;
  /**
   * The estimated cost of the paid AI call the handler makes. It is reserved against the
   * user's, the brand's and the day's allowances before the handler runs, and given back
   * if the handler throws. Only routes for members can have one: a brand pays.
   */
  cost?: A extends "member" ? RouteCost<InputOf<S>> : never;
  handler: (context: {
    input: InputOf<S>;
    session: SessionFor<A>;
    request: Request;
  }) => Promise<T | Response>;
}>;

export type RouteContext = Readonly<{
  params: Promise<Record<string, string | string[] | undefined>>;
}>;

export type RouteHandler = (request: Request, context: RouteContext) => Promise<Response>;

const PARTS = ["params", "query", "body", "form"] as const;

type Part = (typeof PARTS)[number];

const json = <T>(result: Result<T>, status: number, headers: Record<string, string> = {}) =>
  Response.json(result, { status, headers: { "cache-control": "no-store", ...headers } });

const refuse = (failure: Failure, headers: Record<string, string> = {}) =>
  json({ success: false, error: failure }, FAILURE_STATUS[failure.code], headers);

const queryOf = (request: Request): Record<string, string | string[]> => {
  const { searchParams } = new URL(request.url);
  return Object.fromEntries(
    [...new Set(searchParams.keys())].map((key) => {
      const values = searchParams.getAll(key);
      return [key, values.length > 1 ? values : values[0]];
    }),
  );
};

/** What the request carries for one part, before it is checked against the schema. */
const readPart = async (
  part: Part,
  request: Request,
  context: RouteContext,
  maxBodyBytes: number,
): Promise<BodyRead> => {
  if (part === "params") return { ok: true, value: await context.params };
  if (part === "query") return { ok: true, value: queryOf(request) };
  return part === "body" ? readJson(request, maxBodyBytes) : readForm(request, maxBodyBytes);
};

type Parsed =
  | Readonly<{ ok: true; input: Record<string, unknown> }>
  | Readonly<{ ok: false; failure: Failure }>;

const parseInput = async (
  schemas: RouteSchemas,
  request: Request,
  context: RouteContext,
  maxBodyBytes: number,
): Promise<Parsed> => {
  const checked: { part: Part; data?: unknown; errors?: FieldErrors }[] = [];

  for (const part of PARTS) {
    const schema = schemas[part];
    if (!schema) continue;
    const read = await readPart(part, request, context, maxBodyBytes);
    if (!read.ok) return read;
    const result = schema.safeParse(read.value);
    checked.push(
      result.success
        ? { part, data: result.data }
        : { part, errors: fieldErrors(result.error.issues, part) },
    );
  }

  const errors = Object.assign({}, ...checked.map((entry) => entry.errors ?? {})) as FieldErrors;
  return Object.keys(errors).length > 0
    ? { ok: false, failure: invalidInput(errors) }
    : { ok: true, input: Object.fromEntries(checked.map(({ part, data }) => [part, data])) };
};

/** Who pays for a metered call. Only a member session carries a brand. */
const payerOf = (session: unknown): { userId: string; brandId: string } => {
  const member = session as MemberSession | null;
  if (!member?.brand) throw new Error("A route with a cost must be for members.");
  return { userId: member.userId, brandId: member.brand.id };
};

/**
 * Builds `defineRoute` around a set of dependencies. Every route handler in the app is
 * the output of `defineRoute`, which the architecture test enforces.
 */
export const createDefineRoute =
  (deps: GuardDeps) =>
  <A extends Auth, S extends RouteSchemas, T>(config: RouteConfig<A, S, T>): RouteHandler =>
    async function route(request, context) {
      const where = `${request.method} ${new URL(request.url).pathname}`;
      try {
        const admission = await admit(deps, config.auth, config.rateLimit);
        if (!admission.ok) {
          const retry: Record<string, string> =
            admission.failure.code === "rate_limited"
              ? { "retry-after": String(config.rateLimit.windowSeconds) }
              : {};
          return refuse(admission.failure, retry);
        }

        const parsed = await parseInput(
          config.schema,
          request,
          context,
          config.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES,
        );
        if (!parsed.ok) return refuse(parsed.failure);

        const input = parsed.input as InputOf<S>;
        const run = () => config.handler({ input, session: admission.session, request });
        const metered = config.cost
          ? await runMetered(deps, payerOf(admission.session), costOf(config.cost, input), where, run)
          : { ok: true as const, value: await run() };
        if (!metered.ok) return refuse(metered.failure);

        const output = metered.value;
        return output instanceof Response ? output : json({ success: true, data: output }, 200);
      } catch (error) {
        return refuse(failureFrom(deps, error, where));
      }
    };
