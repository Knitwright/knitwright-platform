import type { Failure, Result } from "@/lib/server/core/errors";

/**
 * What a form remembers between attempts. It holds no React and no framework code, so
 * it can be tested on its own. The hook in components/forms/useFormAction.ts uses it.
 */

export type FormAction<T> = (input: unknown) => Promise<Result<T>>;

export type FormState<T> = Readonly<{
  result: Result<T> | null;
  /** Counts submissions. Each one needs a fresh bot check, because a token works once. */
  attempt: number;
  /** What the user typed, so a failed attempt does not empty the form. */
  values: Readonly<Record<string, string>>;
}>;

/** Only these are kept. A password is never held in the page's state. */
const KEPT_FIELDS = ["email", "name"] as const;

const UNREACHABLE: Failure = {
  code: "unavailable",
  message: "We could not reach the server. Check your connection and try again.",
};

export const initialFormState = <T>(): FormState<T> => ({ result: null, attempt: 0, values: {} });

const keptValues = (form: FormData): Record<string, string> =>
  Object.fromEntries(
    KEPT_FIELDS.flatMap((name) => {
      const value = form.get(name);
      return typeof value === "string" ? [[name, value]] : [];
    }),
  );

/**
 * Runs the action and returns the form's next state. A call that never reached the
 * server becomes a failure the form can show. `rethrow` lets the framework's own
 * control flow, such as a redirect, pass through.
 */
export const nextFormState = async <T>(
  previous: FormState<T>,
  form: FormData,
  action: FormAction<T>,
  rethrow: (error: unknown) => void,
): Promise<FormState<T>> => {
  const settled = { attempt: previous.attempt + 1, values: keptValues(form) };
  try {
    return { ...settled, result: await action(form) };
  } catch (error) {
    rethrow(error);
    return { ...settled, result: { success: false, error: UNREACHABLE } };
  }
};

export const failureOf = <T>(state: FormState<T>): Failure | null =>
  state.result && !state.result.success ? state.result.error : null;

/** One sentence for the top of the form, announced to screen readers. */
export const summaryOf = <T>(state: FormState<T>): string | null =>
  failureOf(state)?.message ?? null;
