import { deltaVerdict } from "@/lib/make/judge";

/**
 * Typed colour readings at inspection (spec F-O3, "colour against the swatch with a ΔE reading"; rule
 * R-SUB-005; plan v5 O1, decision 0100).
 *
 * Every number is typed by the inspector off the instrument. Nothing here computes a Delta-E from a hex code,
 * and nothing invents a tolerance: the limit is the factory's own `colour_delta_max`, copied onto the reading
 * so the judgement can be checked later, and null when no tolerance is on file. A reading with no limit
 * judges nothing, which is what `deltaVerdict` (the make flow's rule, reused here) already says.
 */

export interface ColourReading {
  readonly colourName: string;
  /** The Delta-E the instrument gave. */
  readonly deltaE: number;
  /** The factory's own tolerance at the time of the reading, or null when none is on file. */
  readonly limitDeltaE: number | null;
  /** Which difference formula, which instrument, which white point, which observer. Null: nobody stated it. */
  readonly method: string | null;
  readonly instrument: string | null;
  readonly whitePoint: string | null;
  readonly observer: string | null;
  readonly ruleId: string;
}

/** R-SUB-005 is the rule that says colour is checked against a strike-off and holds the tolerance. */
export const COLOUR_RULE_ID = "R-SUB-005";

type Parsed<T> = Readonly<{ ok: true; value: T }> | Readonly<{ ok: false; problem: string }>;

const lines = (text: string): string[] => text.split(/\r?\n|;/).map((l) => l.trim()).filter((l) => l !== "");

const number = (text: string): number | null => (/^\d+(\.\d{1,3})?$/.test(text.trim()) ? Number(text) : null);

export const MAX_READINGS = 20;

/**
 * `Kit navy, 1.2` per line: the colour and the Delta-E the instrument gave. The limit is not typed in — it
 * comes from the factory's row — so a reading can never be judged against a number the inspector chose.
 */
export function parseColourReadings(text: string, limitDeltaE: number | null, ruleId = COLOUR_RULE_ID): Parsed<readonly ColourReading[]> {
  const found: ColourReading[] = [];
  for (const line of lines(text)) {
    const parts = line.split(",").map((p) => p.trim());
    const [colourName, delta] = parts;
    const value = delta === undefined ? null : number(delta);
    if (parts.length !== 2 || !colourName || colourName.length > 60 || value === null || value > 200) {
      return { ok: false, problem: `Cannot read "${line.slice(0, 60)}". Write: colour, Delta-E reading.` };
    }
    found.push({ colourName, deltaE: value, limitDeltaE, method: null, instrument: null, whitePoint: null, observer: null, ruleId });
  }
  if (found.length > MAX_READINGS) return { ok: false, problem: `Up to ${MAX_READINGS} colour readings.` };
  return { ok: true, value: found };
}

export type ReadingVerdict = Readonly<{
  colourName: string;
  status: "inside" | "outside" | "no-limit";
  /** One sentence a reader can act on. Never softened, and never a number nobody agreed. */
  text: string;
  ruleId: string;
}>;

/** What one reading says, against the limit it was judged by. The rule is the make flow's; only the words differ. */
export function readingVerdict(reading: ColourReading): ReadingVerdict {
  const verdict = deltaVerdict(reading.colourName, reading.deltaE, reading.limitDeltaE, reading.ruleId);
  return {
    colourName: reading.colourName,
    status: verdict.status,
    text: "text" in verdict ? verdict.text : verdict.finding.message,
    ruleId: reading.ruleId,
  };
}

/**
 * Whether the readings let the inspection pass: every reading that has a limit on file is inside it. A
 * reading with no limit never fails an order, because nothing on file says what would. The SQL function
 * `private.ops_colour_readings_pass` does the same sum and the integration test holds the two to each other.
 */
export const colourReadingsPass = (readings: readonly ColourReading[]): boolean =>
  readings.every((r) => r.limitDeltaE === null || r.deltaE <= r.limitDeltaE);

/** The sentence shown where no factory tolerance is on file, so nothing is judged. */
export const NO_COLOUR_LIMIT =
  "No colour tolerance is on file for this factory, so a reading is recorded and nothing says whether it passes. Agree one with the factory (rule R-SUB-005).";
