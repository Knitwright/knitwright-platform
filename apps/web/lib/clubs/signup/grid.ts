import { ALL_IN, COLLECTED_LABEL, EXTRA_LABEL, MISSING_LABEL, NO_REQUESTS_YET } from "./fields";
import { matchKey } from "./paste";

/**
 * Who has answered and who has not (spec F-T4 step 4 "a grid of collected vs missing entries",
 * plan v5 Z7, decision 0086).
 *
 * The grid is over the people the club said it is waiting on, not over the roster, because a roster
 * row cannot exist without a size and the whole point of the grid is the people whose size is not
 * known yet. An answer from someone who is not on the list is shown as well, named as such, so a
 * club is never surprised by a player it did not expect.
 *
 * Nothing here decides anything. A duplicate number is flagged and kept, as F-T4 asks: two players
 * may genuinely share a number across two teams, and only the club knows which.
 */

export interface SignupRequest {
  readonly id: string;
  readonly name: string;
  readonly phone: string;
  readonly email: string;
}

export interface SignupEntry {
  readonly id: string;
  readonly nameOnShirt: string;
  readonly number: string;
  readonly sizeLabel: string;
  readonly wearerGroup: string;
  readonly updatedAt: string;
}

export interface GridRow {
  readonly key: string;
  readonly name: string;
  /** The person on the club's list, or null for an answer that matched nobody on it. */
  readonly requestId: string | null;
  readonly state: "collected" | "missing" | "extra";
  readonly stateLabel: string;
  /** What they sent, or null while the club is still waiting on them. */
  readonly entry: SignupEntry | null;
  readonly phone: string;
  readonly email: string;
  /** Why this row needs a second look: a repeated number, or a repeated name. */
  readonly flags: readonly GridFlag[];
}

export interface GridFlag {
  readonly kind: "duplicate_number" | "duplicate_name";
  readonly message: string;
  /** No rulebook entry names either check yet (decision 0067); the PR lists both. */
  readonly ruleId: "R-GAP-000";
}

export interface Grid {
  readonly rows: readonly GridRow[];
  readonly collected: number;
  readonly missing: number;
  readonly extra: number;
  /** One line a club reads at a glance, or the empty state when there is no list yet. */
  readonly summary: string;
}

const STATE_LABELS: Readonly<Record<GridRow["state"], string>> = {
  collected: COLLECTED_LABEL,
  missing: MISSING_LABEL,
  extra: EXTRA_LABEL,
};

const flag = (kind: GridFlag["kind"], message: string): GridFlag => ({ kind, message, ruleId: "R-GAP-000" });

/** Which numbers more than one answer used, as printed, so "07" and "7" are told apart. */
const repeatedNumbers = (entries: readonly SignupEntry[]): ReadonlySet<string> => {
  const seen = new Map<string, number>();
  for (const entry of entries) seen.set(entry.number, (seen.get(entry.number) ?? 0) + 1);
  return new Set([...seen].filter(([, count]) => count > 1).map(([number]) => number));
};

/** Which shirt names more than one answer used. Two players printing one name is almost always a slip. */
const repeatedNames = (entries: readonly SignupEntry[]): ReadonlySet<string> => {
  const seen = new Map<string, number>();
  for (const entry of entries) {
    const key = matchKey(entry.nameOnShirt);
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return new Set([...seen].filter(([, count]) => count > 1).map(([key]) => key));
};

const flagsFor = (entry: SignupEntry | null, numbers: ReadonlySet<string>, names: ReadonlySet<string>): readonly GridFlag[] => {
  if (!entry) return [];
  const found: GridFlag[] = [];
  if (numbers.has(entry.number)) found.push(flag("duplicate_number", `Number ${entry.number} is used more than once.`));
  if (names.has(matchKey(entry.nameOnShirt))) found.push(flag("duplicate_name", `The name ${entry.nameOnShirt} is used more than once.`));
  return found;
};

const summaryOf = (collected: number, missing: number, extra: number, requests: number): string => {
  if (requests === 0 && extra === 0) return NO_REQUESTS_YET;
  const head = missing === 0 && requests > 0 ? ALL_IN : `${collected} of ${requests} in, ${missing} still waiting.`;
  return extra === 0 ? head : `${head} ${extra} ${extra === 1 ? "answer" : "answers"} came from someone not on your list.`;
};

/**
 * The grid: one row per person the club is waiting on, in the order the club gave them, then one
 * row for each answer that matched nobody.
 */
export function buildGrid(requests: readonly SignupRequest[], entries: readonly SignupEntry[]): Grid {
  const numbers = repeatedNumbers(entries);
  const names = repeatedNames(entries);
  const byKey = new Map(entries.map((entry) => [matchKey(entry.nameOnShirt), entry] as const));
  const matched = new Set<string>();
  const rows: GridRow[] = requests.map((request) => {
    const key = matchKey(request.name);
    const entry = byKey.get(key) ?? null;
    if (entry) matched.add(key);
    return {
      key,
      name: request.name,
      requestId: request.id,
      state: entry ? ("collected" as const) : ("missing" as const),
      stateLabel: entry ? STATE_LABELS.collected : STATE_LABELS.missing,
      entry,
      phone: request.phone,
      email: request.email,
      flags: flagsFor(entry, numbers, names),
    };
  });
  const extras: GridRow[] = entries
    .filter((entry) => !matched.has(matchKey(entry.nameOnShirt)))
    .map((entry) => ({
      key: matchKey(entry.nameOnShirt),
      name: entry.nameOnShirt,
      requestId: null,
      state: "extra" as const,
      stateLabel: STATE_LABELS.extra,
      entry,
      phone: "",
      email: "",
      flags: flagsFor(entry, numbers, names),
    }));
  const collected = rows.filter((row) => row.state === "collected").length;
  const missing = rows.length - collected;
  return {
    rows: [...rows, ...extras],
    collected,
    missing,
    extra: extras.length,
    summary: summaryOf(collected, missing, extras.length, requests.length),
  };
}

/** The people the club is still waiting on, which is who a chase goes to. */
export const stillWaiting = (grid: Grid): readonly GridRow[] => grid.rows.filter((row) => row.state === "missing");
