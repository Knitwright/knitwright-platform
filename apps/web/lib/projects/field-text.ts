import { parseCmInput } from "./measurement-input";

/**
 * The text of a measurement field, kept apart from the screen. Text is compared as a
 * length, never as text: "52,5", " 52.5 " and "52.50" all mean 52.5.
 */

export type RowFacts = Readonly<{
  /** The value the server holds, as shown in a field. Empty when there is none. */
  valueCm: string;
  valueTenths: number | null;
  /** True when the person typed the value. A chart value or a suggestion is not theirs. */
  isOwn: boolean;
}>;

export type EditIntent =
  | Readonly<{ kind: "none" }>
  | Readonly<{ kind: "set"; tenths: number }>
  | Readonly<{ kind: "remove" }>
  | Readonly<{ kind: "invalid"; reason: string }>;

const NONE: EditIntent = { kind: "none" };

/** Whether two field texts mean the same length. Text that is not a length is compared as text. */
export const sameCm = (a: string, b: string): boolean => {
  const left = a.trim();
  const right = b.trim();
  if (left === "" || right === "") return left === right;
  const first = parseCmInput(left);
  const second = parseCmInput(right);
  return first.ok && second.ok ? first.tenths === second.tenths : left === right;
};

/** What the text in a field asks for, given what the row holds now. */
export const intentFromText = (text: string, row: RowFacts): EditIntent => {
  if (text.trim() === "") return row.isOwn ? { kind: "remove" } : NONE;
  const typed = parseCmInput(text);
  if (!typed.ok) return { kind: "invalid", reason: typed.reason };
  return typed.tenths === row.valueTenths ? NONE : { kind: "set", tenths: typed.tenths };
};

export const isDirty = (text: string, valueCm: string): boolean => !sameCm(text, valueCm);

/** Whether leaving the page would lose something. */
export const hasUnsavedWork = (busy: boolean, dirtyFields: readonly boolean[]): boolean =>
  busy || dirtyFields.some(Boolean);

export type FieldState = Readonly<{
  text: string;
  /** The value the server last held. */
  server: string;
  touched: boolean;
  /** The text that was sent and is waiting for an answer. */
  sent: string | null;
  /** True when the design changed while the person was typing, and their text was kept. */
  changedElsewhere: boolean;
}>;

export type FieldEvent =
  | Readonly<{ type: "type"; text: string }>
  | Readonly<{ type: "sent" }>
  | Readonly<{ type: "server"; valueCm: string }>;

export const initialField = (valueCm: string): FieldState => ({
  text: valueCm,
  server: valueCm,
  touched: false,
  sent: null,
  changedElsewhere: false,
});

const onServer = (state: FieldState, valueCm: string): FieldState => {
  if (valueCm === state.server) return state;
  // Emptying the field asks for the person's own value to go, so any value that comes back answers it.
  const answeredOurSave = state.sent !== null && (state.sent.trim() === "" || sameCm(state.sent, valueCm));
  const stillTyping = state.touched && !sameCm(state.text, state.sent ?? state.server);
  if (answeredOurSave && !stillTyping) return { ...initialField(valueCm) };
  if (!state.touched || sameCm(state.text, valueCm)) return initialField(valueCm);
  return {
    ...state,
    server: valueCm,
    sent: answeredOurSave ? null : state.sent,
    changedElsewhere: !answeredOurSave,
  };
};

export const fieldReduce = (state: FieldState, event: FieldEvent): FieldState => {
  switch (event.type) {
    case "type":
      return {
        ...state,
        text: event.text,
        touched: true,
        changedElsewhere: state.changedElsewhere && !sameCm(event.text, state.server),
      };
    case "sent":
      return { ...state, sent: state.text };
    case "server":
      return onServer(state, event.valueCm);
  }
};
