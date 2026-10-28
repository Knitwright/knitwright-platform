import { chartSourceSchema, type ChartSource } from "./schemas";

type SourceNoteResult =
  | { readonly ok: true; readonly source: ChartSource }
  | { readonly ok: false; readonly message: string };

/** A date that does not touch another digit on either side. */
const DATE_PATTERN = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g;
const EARLIEST_SOURCE_YEAR = 1900;
/** Words that link a name to a date, such as "Sameed on 2026-10-02". They are not part of the name. */
const LINK_WORDS = /\s+(?:on|dated|date|by)$|^(?:by|from)\s+/i;
/** A dash is only a separator when a space follows it, so "-Sam" keeps its dash and is refused. */
const LEADING_EDGE = /^(?:[\s,;:()/\\]|-(?=\s))+/;
const TRAILING_EDGE = /[\s,;:()/\\-]+$/;
const FORMULA_STARTS = ["=", "+", "-", "@"];

const refuse = (message: string): SourceNoteResult => ({ ok: false, message });

const trimEdges = (text: string): string => text.replace(LEADING_EDGE, "").replace(TRAILING_EDGE, "");

/** Removes punctuation and link words from both ends until nothing more comes off. */
function stripLinkWords(text: string): string {
  let current = trimEdges(text);
  for (;;) {
    const next = trimEdges(current.replace(LINK_WORDS, ""));
    if (next === current) return current;
    current = next;
  }
}

function dateProblem(date: string, today: Date): string | null {
  if (Number(date.slice(0, 4)) < EARLIEST_SOURCE_YEAR) return `The year must be ${EARLIEST_SOURCE_YEAR} or later.`;
  if (date > today.toISOString().slice(0, 10)) {
    return "The date is in the future. Use the day the numbers were produced.";
  }
  return null;
}

/**
 * Reads a source note such as "Sameed Ilyas, 2026-10-02" into a person and a date.
 * The date is year, month and day, on its own, from 1900 on and not after today. A note
 * missing either part, with two dates, or with a name that starts like a formula is refused.
 * Today is an argument so that tests are steady.
 */
export function parseSourceNote(text: string, today: Date = new Date()): SourceNoteResult {
  const note = text.trim();
  if (note === "") {
    return refuse("Every chart needs a source. Write who produced the numbers and the date, like Sameed Ilyas, 2026-10-02.");
  }
  const dates = note.match(DATE_PATTERN) ?? [];
  const [date] = dates;
  if (date === undefined) {
    return refuse("The source needs a date as year, month and day, such as 2026-10-02.");
  }
  if (dates.length > 1) {
    return refuse("The source has more than one date. Give only the one day the numbers were produced.");
  }
  const tooEarlyOrLate = dateProblem(date, today);
  if (tooEarlyOrLate !== null) return refuse(tooEarlyOrLate);
  const person = stripLinkWords(note.replace(date, " ")).replace(/\s+/g, " ");
  if (FORMULA_STARTS.some((start) => person.startsWith(start))) {
    return refuse(
      `The name "${person}" starts with an equals, plus, minus or at sign, so a spreadsheet could read it as a formula. Write the name without it.`,
    );
  }
  const parsed = chartSourceSchema.safeParse({ person, date });
  if (parsed.success) return { ok: true, source: parsed.data };
  const reason = parsed.error.issues[0]?.message ?? "It is not valid.";
  return refuse(`The source is not valid. ${reason}`);
}
