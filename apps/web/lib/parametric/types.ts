import type { Pt } from "./geometry";

/** A problem with the request, carrying the rulebook entry that explains it. `R-GAP-000` means no entry yet. */
export type Finding = Readonly<{ ruleId: string; field: string; message: string }>;

/** What a caller asks for. Missing parameters and options take the article's defaults. */
export type DraftInput = Readonly<{
  parameters?: Readonly<Record<string, number>>;
  options?: Readonly<Record<string, string>>;
}>;

/** Every parameter and option group with the value used. */
export type ResolvedInput = Readonly<{
  parameters: Readonly<Record<string, number>>;
  options: Readonly<Record<string, string>>;
}>;

/** A notch as the cutter sees it: a 5 mm slit from the cut line into the seam allowance. */
export type NotchMark = Readonly<{ seamId: string; slit: readonly [Pt, Pt] }>;

/**
 * One drafted piece in the script's frame (mm, y down). Body pieces have the high point of the
 * shoulder at y = 0 and the centre line at x = 0; the sleeve has its cap top at the origin.
 */
export type DraftPiece = Readonly<{
  id: string;
  /** The name printed on the piece, as the reference files print it. */
  label: string;
  /** Pieces cut in all. */
  cut: number;
  mirroredPair: boolean;
  fabricCode: string;
  sewLine: readonly Pt[];
  cutLine: readonly Pt[];
  notches: readonly NotchMark[];
  seamAllowance: readonly Readonly<{ seamId: string; mm: number }>[];
  landmarks: Readonly<Record<string, Pt>>;
}>;

/** A measurement the pattern was built to, beside the value it was meant to have. */
export type PomCheck = Readonly<{ label: string; target: number; actual: number }>;

/** A length of the drafted pattern that must agree with another (armhole and cap, neck and rib). */
export type SeamLength = Readonly<{ label: string; mm: number }>;

export type ArticleDraft = Readonly<{
  articleCode: string;
  articleVersion: string;
  size: string;
  input: ResolvedInput;
  pieces: readonly DraftPiece[];
  checks: readonly PomCheck[];
  lengths: readonly SeamLength[];
  /** Notes that do not stop the draft, such as a parameter range no sample has signed off yet. */
  warnings: readonly Finding[];
}>;

export type DraftOutcome =
  | Readonly<{ kind: "drafted"; draft: ArticleDraft }>
  | Readonly<{ kind: "not-drafted-yet"; articleCode: string; reason: string; ruleId: string | null }>
  | Readonly<{ kind: "invalid"; articleCode: string; findings: readonly Finding[] }>;

export const NOT_DRAFTED_YET = "Not drafted yet";
