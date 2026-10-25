export type PriceLadder = Readonly<{ status: "not-set" }> | Readonly<{ status: "set"; value: readonly Readonly<{ fromPieces: number; unitPrice: number }>[] }>;

export const WILL_QUOTE = "Knitwright will quote";

export type Quote =
  | Readonly<{ status: "not-set"; text: typeof WILL_QUOTE }>
  | Readonly<{ status: "quoted"; fromPieces: number; unitPrice: number; text: string }>;

/**
 * The factory's unit price for a quantity: the last step of the ladder that starts at or below it. A missing ladder, or a
 * quantity below the first step, is not priced here (the platform never invents a price or a currency).
 */
export function quoteFor(pieces: number, ladder: PriceLadder): Quote {
  if (ladder.status === "not-set") return { status: "not-set", text: WILL_QUOTE };
  const steps = [...ladder.value].sort((a, b) => a.fromPieces - b.fromPieces);
  const step = steps.filter((s) => s.fromPieces <= pieces).at(-1);
  if (!step) return { status: "not-set", text: WILL_QUOTE };
  return { status: "quoted", fromPieces: step.fromPieces, unitPrice: step.unitPrice, text: `${step.unitPrice} per piece from ${step.fromPieces} pieces, from the factory's price ladder` };
}
