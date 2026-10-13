import { initialFormState, type FormState } from "./form-state";

/**
 * A form that is sent once, such as a vote or a quote request. The answer is shown as soon as
 * the server gives it. It does not wait for the page to be drawn again with fresh data, which
 * can take long or never finish, and which once left these forms on "Sending" although the
 * answer was saved. While sending, and once sent, the form cannot be sent again.
 */

export type SendPhase = "ready" | "sending" | "sent" | "failed";

export type SendState<T> = Readonly<{ phase: SendPhase; form: FormState<T> }>;

export type SendEvent<T> =
  | Readonly<{ type: "send" }>
  | Readonly<{ type: "answered"; form: FormState<T> }>;

export const initialSendState = <T>(): SendState<T> => ({ phase: "ready", form: initialFormState<T>() });

/** True when the form may be sent: never while it is on its way, and never again once it went through. */
export const canSend = <T>(state: SendState<T>): boolean => state.phase === "ready" || state.phase === "failed";

export const sendReducer = <T>(state: SendState<T>, event: SendEvent<T>): SendState<T> => {
  switch (event.type) {
    case "send":
      return canSend(state) ? { ...state, phase: "sending" } : state;
    case "answered":
      if (state.phase !== "sending") return state;
      return { phase: event.form.result?.success ? "sent" : "failed", form: event.form };
  }
};
