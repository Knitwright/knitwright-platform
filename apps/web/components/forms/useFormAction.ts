"use client";

import { unstable_rethrow } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import {
  failureOf,
  initialFormState,
  nextFormState,
  summaryOf,
  type FormAction,
  type FormState,
} from "@/lib/forms/form-state";

const INVALID_FIELD = '[aria-invalid="true"]';
const SUMMARY = "[data-form-summary]";

/**
 * Runs a server action from a form and keeps its last answer. After a failed attempt
 * it moves focus to the first field that needs another look, or to the summary, so
 * keyboard and screen reader users are taken to the problem.
 */
export const useFormAction = <T>(action: FormAction<T>) => {
  const form = useRef<HTMLFormElement>(null);
  const [state, submit, pending] = useActionState(
    (previous: FormState<T>, data: FormData) =>
      nextFormState(previous, data, action, unstable_rethrow),
    initialFormState<T>(),
  );

  const failure = failureOf(state);

  useEffect(() => {
    if (!failure) return;
    const target =
      form.current?.querySelector<HTMLElement>(INVALID_FIELD) ??
      form.current?.querySelector<HTMLElement>(SUMMARY);
    target?.focus();
  }, [failure, state.attempt]);

  return {
    form,
    state,
    submit,
    pending,
    failure,
    summary: summaryOf(state),
    fieldErrors: (name: string): readonly string[] => failure?.fields?.[name] ?? [],
  };
};
