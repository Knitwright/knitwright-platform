import { cleanName } from "@/lib/orders/text";
import { REQUESTS_MAX } from "./fields";

/**
 * The pasted list (spec F-T4 step 1 "paste a list", plan v5 Z7, decision 0086).
 *
 * One person per line. A line may carry a phone number or an email address after a comma or a tab,
 * because that is how a club's own list usually looks, and because a chase needs one of them. Names
 * are cleaned with the same rule team orders and rosters use (decision 0027), so a name that
 * reaches the shirt is cleaned once, in one place. The CSV path is not repeated here: it is the
 * import the club workspace already has (`lib/clubs/roster.ts`).
 */

export interface PastedPerson {
  readonly name: string;
  readonly phone: string;
  readonly email: string;
}

export interface PasteProblem {
  readonly line: number;
  readonly message: string;
}

export interface PasteRead {
  readonly people: readonly PastedPerson[];
  readonly problems: readonly PasteProblem[];
  /** The names that appeared more than once, folded the way the database folds them. */
  readonly duplicates: readonly string[];
}

/** The same folding the database does, so a browser and the database always agree who is who. */
export const matchKey = (name: string): string => name.trim().replace(/\s+/g, " ").toLowerCase().slice(0, 40);

const PHONE = /^\+?[0-9][0-9 ()-]{4,24}$/;
const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

const cellsOf = (line: string): string[] => line.split(/[,\t;]/).map((cell) => cell.trim());

/** A line's name, phone and email, whichever of the three it holds. */
function personOf(line: string, at: number): PastedPerson | PasteProblem {
  const cells = cellsOf(line);
  const [first, ...rest] = cells;
  const cleaned = cleanName(first ?? "");
  if (!cleaned.ok) return { line: at, message: cleaned.message };
  // cleanName accepts an empty name, which a roster may hold but a person on a list may not: the
  // name is the only thing that matches an answer to the person it came from.
  if (cleaned.name === "") return { line: at, message: "This line has no name on it." };
  const email = rest.find((cell) => EMAIL.test(cell)) ?? "";
  const phone = rest.find((cell) => PHONE.test(cell)) ?? "";
  return { name: cleaned.name, email: email.toLowerCase(), phone: phone.replace(/[^+0-9]/g, "") };
}

const isProblem = (value: PastedPerson | PasteProblem): value is PasteProblem => "line" in value;

/**
 * Reads a pasted list. Blank lines are skipped. A name that appears twice is kept once and named in
 * `duplicates`, so the club is told rather than quietly given a shorter list.
 */
export function readPastedList(text: string): PasteRead {
  const lines = text.split(/\r?\n/);
  const problems: PasteProblem[] = [];
  const people: PastedPerson[] = [];
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const [index, line] of lines.entries()) {
    if (line.trim() === "") continue;
    if (people.length >= REQUESTS_MAX) {
      problems.push({ line: index + 1, message: `A season may be waiting on ${REQUESTS_MAX} people. The rest of the list was not read.` });
      break;
    }
    const read = personOf(line, index + 1);
    if (isProblem(read)) {
      problems.push(read);
      continue;
    }
    const key = matchKey(read.name);
    if (seen.has(key)) {
      duplicates.add(read.name);
      continue;
    }
    seen.add(key);
    people.push(read);
  }
  return { people, problems, duplicates: [...duplicates] };
}
