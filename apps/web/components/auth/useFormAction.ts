"use client";

import { useActionState } from "react";
import type { Result } from "@/lib/server/core/errors";

type Action<T> = (input: unknown) => Promise<Result<T>>;

export type FormState<T> = Readonly<{
  result: Result<T> | null;
  /** Counts submissions. Used to ask for a fresh bot check after each one. */
  attempt: number;
  /** What the user typed, so a failed submit does not empty the form. */
  values: Readonly<Record<string, string>>;
}>;

const KEPT_FIELDS = ["email"] as const;

const keptValues = (form: FormData): Record<string, string> =>
  Object.fromEntries(
    KEPT_FIELDS.map((name) => [name, form.get(name)])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
      .map(([name, value]) => [name, value]),
  );

/** Runs a server action from a form and keeps its last answer. */
export const useFormAction = <T>(action: Action<T>) => {
  const initial: FormState<T> = { result: null, attempt: 0, values: {} };
  const [state, submit, pending] = useActionState(
    async (previous: FormState<T>, form: FormData): Promise<FormState<T>> => ({
      result: await action(form),
      attempt: previous.attempt + 1,
      values: keptValues(form),
    }),
    initial,
  );

  const failure = state.result && !state.result.success ? state.result.error : null;
  return {
    state,
    submit,
    pending,
    failure,
    fieldErrors: (name: string) => failure?.fields?.[name] ?? [],
    /** A failure that belongs to no single field. */
    formError: failure && !failure.fields ? failure.message : null,
  };
};
