import { blocker, pieces, SAMPLE_MAX_SIZES, SAMPLE_PIECES_PER_SIZE, type MakeFinding } from "./vocabulary";

/**
 * The sample request (F-S7): one piece per size, at most three sizes. The sizes offered are the design's own size run;
 * a design with no size run lets the sizes be typed, as the run builder does (decision 0062, rule 5).
 *
 * The database checks the same two rules again (`submit_make_order`, and `submit_brand_run` for the one piece), so a
 * request that skips the screen is refused there too.
 */

export interface SampleRequest {
  /** The sizes chosen, in the order they were chosen. */
  readonly sizes: readonly string[];
  /** The design's size run. Empty when the design has none. */
  readonly sizeRun: readonly string[];
}

export interface SampleCheck {
  /** What goes to the contract: `{"M": 1}`. Empty while the request is not usable. */
  readonly sizes: Readonly<Record<string, number>>;
  readonly pieces: number;
  readonly findings: readonly MakeFinding[];
  readonly canSend: boolean;
}

const unique = (sizes: readonly string[]): readonly string[] => [...new Set(sizes)];

export function checkSampleRequest(request: SampleRequest): SampleCheck {
  const chosen = unique(request.sizes.map((size) => size.trim()).filter((size) => size !== ""));
  const unknown = request.sizeRun.length === 0 ? [] : chosen.filter((size) => !request.sizeRun.includes(size));
  const findings = [
    chosen.length === 0 ? blocker("sample_no_size", "Choose at least one size for the sample.") : null,
    chosen.length > SAMPLE_MAX_SIZES
      ? blocker("sample_sizes", `A sample is at most ${SAMPLE_MAX_SIZES} sizes, one piece of each. You chose ${chosen.length}.`)
      : null,
    unknown.length > 0 ? blocker("sample_size_unknown", `This design's size run does not have ${unknown.join(", ")}.`) : null,
  ].filter((found): found is MakeFinding => found !== null);

  const usable = findings.length === 0;
  return {
    sizes: usable ? Object.fromEntries(chosen.map((size) => [size, SAMPLE_PIECES_PER_SIZE])) : {},
    pieces: usable ? chosen.length * SAMPLE_PIECES_PER_SIZE : 0,
    findings,
    canSend: usable,
  };
}

/** "Two sizes, one piece each: 2 pieces." The sentence under the size picker. */
export const describeSample = (check: SampleCheck): string =>
  check.pieces === 0
    ? `One piece per size, up to ${SAMPLE_MAX_SIZES} sizes.`
    : `${Object.keys(check.sizes).join(", ")} · one piece each · ${pieces(check.pieces)}.`;
