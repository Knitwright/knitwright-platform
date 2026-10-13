"use client";

import { useEffect, useReducer, useRef, type FormEvent } from "react";
import { failureOf, nextFormState, summaryOf, type FormAction } from "@/lib/forms/form-state";
import { canSend, initialSendState, sendReducer, type SendEvent, type SendState } from "@/lib/forms/send-state";

const INVALID_FIELD = '[aria-invalid="true"]';
const SUMMARY = "[data-form-summary]";

/** Neither action that uses this hook redirects, so nothing is passed back to the framework. */
const keepEverything = (): void => undefined;

/**
 * Sends a form once and shows the server's answer as soon as it comes (lib/forms/send-state).
 * Unlike useFormAction it does not wait for the page to be drawn again. A form held back by
 * an earlier onSubmit handler (a bot check that has not passed) is not sent. After a failed attempt
 * focus moves to the first field that needs another look, or to the summary.
 */
export const useSendForm = <T>(action: FormAction<T>) => {
  const form = useRef<HTMLFormElement>(null);
  const [state, dispatch] = useReducer(
    (current: SendState<T>, event: SendEvent<T>) => sendReducer(current, event),
    undefined,
    () => initialSendState<T>(),
  );
  const failure = failureOf(state.form);

  useEffect(() => {
    if (!failure) return;
    const target =
      form.current?.querySelector<HTMLElement>(INVALID_FIELD) ??
      form.current?.querySelector<HTMLElement>(SUMMARY);
    target?.focus();
  }, [failure, state.form.attempt]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    if (event.defaultPrevented) return;
    event.preventDefault();
    if (!canSend(state)) return;
    const data = new FormData(event.currentTarget);
    dispatch({ type: "send" });
    dispatch({ type: "answered", form: await nextFormState(state.form, data, action, keepEverything) });
  };

  return {
    form,
    onSubmit,
    state: state.form,
    pending: state.phase === "sending",
    sent: state.phase === "sent",
    summary: summaryOf(state.form),
    fieldErrors: (name: string): readonly string[] => failure?.fields?.[name] ?? [],
  };
};
