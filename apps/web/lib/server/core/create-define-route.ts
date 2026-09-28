import type { z } from "zod";
import { FAILURE_STATUS, MESSAGES, type Failure, type FieldErrors, type Result } from "./errors";
import {
  admit,
  failureFrom,
  fieldErrors,
  invalidInput,
  type Auth,
  type GuardDeps,
  type RateLimitRule,
  type SessionFor,
} from "./guard";

const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export type RouteSchemas = Readonly<{
  params?: z.ZodType;
  query?: z.ZodType;
  body?: z.ZodType;
}>;

type InputOf<S extends RouteSchemas> = {
  readonly [K in keyof S]: S[K] extends z.ZodType ? z.output<S[K]> : never;
};

export type RouteConfig<A extends Auth, S extends RouteSchemas, T> = Readonly<{
  /** "public" routes must also be listed in lib/server/public-routes.ts. */
  auth: A;
  rateLimit: RateLimitRule;
  schema: S;
  /** Largest JSON body accepted, in bytes. */
  maxBodyBytes?: number;
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

type BodyRead =
  | Readonly<{ ok: true; value: unknown }>
  | Readonly<{ ok: false; failure: Failure }>;

const readBody = async (request: Request, maxBytes: number): Promise<BodyRead> => {
  const tooLarge: BodyRead = {
    ok: false,
    failure: { code: "too_large", message: MESSAGES.too_large },
  };
  // The declared length lets an oversized body be refused before it is read.
  if (Number(request.headers.get("content-length") ?? 0) > maxBytes) return tooLarge;
  const text = await request.text();
  if (new TextEncoder().encode(text).byteLength > maxBytes) return tooLarge;
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, failure: invalidInput({ body: ["The request body is not valid JSON."] }) };
  }
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
  const raw: Record<string, unknown> = {};
  if (schemas.params) raw.params = await context.params;
  if (schemas.query) raw.query = queryOf(request);
  if (schemas.body) {
    const body = await readBody(request, maxBodyBytes);
    if (!body.ok) return body;
    raw.body = body.value;
  }

  const input: Record<string, unknown> = {};
  let errors: FieldErrors = {};
  for (const part of ["params", "query", "body"] as const) {
    const schema = schemas[part];
    if (!schema) continue;
    const result = schema.safeParse(raw[part]);
    if (result.success) input[part] = result.data;
    else errors = { ...errors, ...fieldErrors(result.error.issues, part) };
  }

  return Object.keys(errors).length > 0
    ? { ok: false, failure: invalidInput(errors) }
    : { ok: true, input };
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

        const output = await config.handler({
          input: parsed.input as InputOf<S>,
          session: admission.session,
          request,
        });
        return output instanceof Response ? output : json({ success: true, data: output }, 200);
      } catch (error) {
        return refuse(failureFrom(deps, error, where));
      }
    };
