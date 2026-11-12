import type { Field, WorkflowForm } from "./forms";

/**
 * A workflow form's answers, checked against the form they came from (decision 0141). The page and
 * the server read the same `WorkflowForm`, so the footer's Generate is enabled exactly when the
 * server would accept, and a choice the page did not offer is refused by the server too.
 */

export type Answers = Readonly<Record<string, string>>;

export type AnswerCheck =
  | Readonly<{ ok: true; answers: Answers; count: number }>
  | Readonly<{ ok: false; errors: Readonly<Record<string, string>> }>;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

const fieldError = (field: Field, raw: string | undefined): string | null => {
  const value = (raw ?? "").trim();
  switch (field.kind) {
    case "product":
      return value === "" ? "Choose a product." : null;
    case "choice":
      return field.options.some((option) => option.value === value) ? null : `Choose a ${field.label.toLowerCase()}.`;
    case "text":
      if (field.required && value === "") return `Fill in “${field.label}”.`;
      return value.length > field.max ? `Keep it under ${field.max} characters.` : null;
    case "date":
      return DATE.test(value) && !Number.isNaN(Date.parse(value)) ? null : "Pick a date.";
    case "toggle":
    case "fixed":
      return null;
  }
};

/** The starting answers: each choice at its first option, the brand applied, the rest empty. */
export function initialAnswers(form: WorkflowForm): Answers {
  const out: Record<string, string> = {};
  for (const field of form.fields) {
    if (field.kind === "choice") out[field.id] = field.initial;
    if (field.kind === "toggle") out[field.id] = "on";
  }
  return out;
}

const clampCount = (form: WorkflowForm, count: number): number | null => {
  if (form.count === null) return 1;
  return Number.isInteger(count) && count >= form.count.min && count <= form.count.max ? count : null;
};

/** The answers, trimmed, or the error under each field that needs one. */
export function checkAnswers(form: WorkflowForm, raw: Answers, count = 1): AnswerCheck {
  const errors: Record<string, string> = {};
  const answers: Record<string, string> = {};
  for (const field of form.fields) {
    const error = fieldError(field, raw[field.id]);
    if (error !== null) errors[field.id] = error;
    else if (field.kind !== "fixed") answers[field.id] = (raw[field.id] ?? "").trim();
  }
  const checked = clampCount(form, count);
  if (checked === null) errors.count = "Pick how many to make.";
  return Object.keys(errors).length > 0 || checked === null ? { ok: false, errors } : { ok: true, answers, count: checked };
}

/** How many of the form's steps are answered, for the footer. */
export const answeredSteps = (form: WorkflowForm, raw: Answers): number =>
  form.fields.filter((field) => field.kind !== "fixed" && fieldError(field, raw[field.id]) === null).length;
