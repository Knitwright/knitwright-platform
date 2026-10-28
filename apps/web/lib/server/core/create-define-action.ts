import type { z } from "zod";
import type { Result } from "./errors";
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

type ActionConfig<A extends Auth, S extends z.ZodType, T> = Readonly<{
  /** "public" actions must also be listed in lib/server/public-routes.ts. */
  auth: A;
  rateLimit: RateLimitRule;
  schema: S;
  handler: (context: { input: z.output<S>; session: SessionFor<A> }) => Promise<T>;
}>;

export type Action<T> = (input: unknown) => Promise<Result<T>>;

/** Fields the framework adds to a submitted form. They are not user input. */
const isFrameworkField = (name: string) => name.startsWith("$ACTION");

type FormRead =
  | Readonly<{ ok: true; value: Record<string, string | string[]> }>
  | Readonly<{ ok: false; field: string }>;

const readForm = (form: FormData): FormRead => {
  const value: Record<string, string | string[]> = {};
  for (const name of new Set(form.keys())) {
    if (isFrameworkField(name)) continue;
    const entries = form.getAll(name);
    const texts = entries.filter((entry): entry is string => typeof entry === "string");
    if (texts.length !== entries.length) return { ok: false, field: name };
    value[name] = texts.length > 1 ? texts : texts[0];
  }
  return { ok: true, value };
};

/**
 * Builds `defineAction` around a set of dependencies. Every server action in the app is
 * the output of `defineAction`, which the architecture test enforces.
 */
export const createDefineAction =
  (deps: GuardDeps) =>
  <A extends Auth, S extends z.ZodType, T>(config: ActionConfig<A, S, T>): Action<T> =>
    async function action(raw) {
      try {
        const admission = await admit(deps, config.auth, config.rateLimit);
        if (!admission.ok) return { success: false, error: admission.failure };

        const form = raw instanceof FormData ? readForm(raw) : { ok: true as const, value: raw };
        if (!form.ok) {
          return {
            success: false,
            error: invalidInput({ [form.field]: ["Files cannot be sent with this form."] }),
          };
        }

        const parsed = config.schema.safeParse(form.value);
        if (!parsed.success) {
          return { success: false, error: invalidInput(fieldErrors(parsed.error.issues)) };
        }

        const data = await config.handler({ input: parsed.data, session: admission.session });
        return { success: true, data };
      } catch (error) {
        return {
          success: false,
          error: failureFrom(deps, error, `action ${config.rateLimit.name}`),
        };
      }
    };
