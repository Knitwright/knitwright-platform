import { chartSourceSchema, type ChartSource } from "./schemas";

export type SourceNoteResult =
  | { readonly ok: true; readonly source: ChartSource }
  | { readonly ok: false; readonly message: string };

const DATE_PATTERN = /\d{4}-\d{2}-\d{2}/;
/** Words that link a name to a date, such as "Sameed on 2026-10-02". They are not part of the name. */
const LINK_WORDS = /\s+(?:on|dated|date|by)$|^(?:by|from)\s+/i;
const EDGE_PUNCTUATION = /^[\s,;:()/\\-]+|[\s,;:()/\\-]+$/g;

/** Removes punctuation and link words from both ends until nothing more comes off. */
function stripLinkWords(text: string): string {
  let current = text.replace(EDGE_PUNCTUATION, "");
  for (;;) {
    const next = current.replace(LINK_WORDS, "").replace(EDGE_PUNCTUATION, "");
    if (next === current) return current;
    current = next;
  }
}

/**
 * Reads a source note such as "Sameed Ilyas, 2026-10-02" into a person and a date.
 * The date is year, month and day. A note missing either one is refused.
 */
export function parseSourceNote(text: string): SourceNoteResult {
  const note = text.trim();
  if (note === "") {
    return { ok: false, message: "Every chart needs a source. Write who produced the numbers and the date, like Sameed Ilyas, 2026-10-02." };
  }
  const dateMatch = DATE_PATTERN.exec(note);
  if (!dateMatch) {
    return { ok: false, message: "The source needs a date as year, month and day, such as 2026-10-02." };
  }
  const rest = note.replace(dateMatch[0], " ").replace(EDGE_PUNCTUATION, "");
  const person = stripLinkWords(rest);
  const parsed = chartSourceSchema.safeParse({ person, date: dateMatch[0] });
  if (parsed.success) return { ok: true, source: parsed.data };
  const reason = parsed.error.issues[0]?.message ?? "It is not valid.";
  return { ok: false, message: `The source is not valid. ${reason}` };
}
