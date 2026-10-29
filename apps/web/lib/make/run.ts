import { blocker, CLASS_A_MIN_PIECES, CLASS_B_MAX_PIECES, CLASS_B_MIN_PIECES, pieces, warning, type MakeFinding } from "./vocabulary";

/**
 * How many pieces a run may be (F-S7): Class A any quantity from one piece, in the weekly batch; Class B 50 to 300 per
 * style from the stock-colour programme. The class is the base article's (decision 0066), not a factory's term, so the
 * range is applied only where a base article covers the design's garment type; where none does, the class is not set,
 * no range is applied, and the screen says so rather than guessing.
 *
 * The factory's own minimum order is separate and is "not set" until a factory agrees one (decision 0071). Under it the
 * run is noted, not refused, as the run builder already does (decision 0062, rule 5).
 */

export type RunClass = "A" | "B" | null;

export interface RunRequest {
  /** Pieces per size, as typed. A size with no number, or a number that is not whole, is a finding. */
  readonly quantities: Readonly<Record<string, string>>;
  readonly productionClass: RunClass;
  /** The factory's minimum order for this article, or null while none is set. */
  readonly moq: number | null;
}

export interface RunCheck {
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly findings: readonly MakeFinding[];
  readonly canSend: boolean;
}

const whole = (text: string): number | null => {
  const value = Number(text.trim());
  return Number.isInteger(value) && value >= 0 ? value : null;
};

/** The sizes with a whole number of pieces above zero, and the labels whose number could not be read. */
function readQuantities(quantities: Readonly<Record<string, string>>): Readonly<{ sizes: Record<string, number>; unreadable: readonly string[] }> {
  const sizes: Record<string, number> = {};
  const unreadable: string[] = [];
  for (const [label, text] of Object.entries(quantities)) {
    if (text.trim() === "") continue;
    const value = whole(text);
    if (value === null) unreadable.push(label);
    else if (value > 0) sizes[label] = value;
  }
  return { sizes, unreadable };
}

/** The class range as a finding, or null when the quantity is inside it (or the class is not set). */
function classFinding(productionClass: RunClass, total: number): MakeFinding | null {
  if (productionClass === null) {
    return warning("class_not_set", "No base article covers this garment type yet, so its production class is not set. The 50 to 300 range for a Class B run is not applied.");
  }
  if (productionClass === "A") {
    return total < CLASS_A_MIN_PIECES ? blocker("class_a_quantity", `A Class A run is ${pieces(CLASS_A_MIN_PIECES)} or more.`) : null;
  }
  if (total < CLASS_B_MIN_PIECES || total > CLASS_B_MAX_PIECES) {
    return blocker("class_b_quantity", `A Class B run is ${CLASS_B_MIN_PIECES} to ${CLASS_B_MAX_PIECES} pieces per style. This one is ${pieces(total)}.`);
  }
  return null;
}

export function checkRun(request: RunRequest): RunCheck {
  const { sizes, unreadable } = readQuantities(request.quantities);
  const total = Object.values(sizes).reduce((sum, value) => sum + value, 0);
  const findings = [
    unreadable.length > 0 ? blocker("run_quantity_unreadable", `Give a whole number of pieces for ${unreadable.join(", ")}.`) : null,
    total === 0 ? blocker("run_no_pieces", "Give the pieces you want for at least one size.") : null,
    total > 0 ? classFinding(request.productionClass, total) : null,
    request.moq !== null && total > 0 && total < request.moq
      ? warning("under_moq", `The factory's minimum order for this article is ${pieces(request.moq)}. This run is ${pieces(total)}.`)
      : null,
    request.moq === null ? warning("moq_not_set", "The factory's minimum order is not set yet.") : null,
  ].filter((found): found is MakeFinding => found !== null);

  const stopped = findings.some((found) => found.severity === "blocker");
  return { sizes: stopped ? {} : sizes, pieces: stopped ? 0 : total, findings, canSend: !stopped };
}
