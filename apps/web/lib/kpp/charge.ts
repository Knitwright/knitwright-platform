import type { GateAnswer, CreditNote } from "@/lib/credits-gate/gate";
import { packageCreditKind, type ChargeDecision, type ChargeForPackage } from "./export";
import type { KppInput } from "./model";

/**
 * The production package's charge, over the credits gate (decision 0051, plan v5 X5b item 2).
 *
 * `lib/kpp/export.ts` checks the package first and charges only when it can be built, so a brand never pays to be
 * told what the factory still has to answer. Then this charges once per design version: asking for the same
 * package again costs nothing, which is what makes a failed download safe to retry.
 *
 * **Owner decision 20 is money.** A sample package for a factory Knitwright does not own is charged; it is free
 * when Knitwright makes the order and free for a production batch. The price in `lib/credits/settings.ts` is a
 * labelled placeholder, not a quoted price, and the owner may overturn both the number and the decision to charge
 * at all. The gate's own refusal says the price is a placeholder, so nobody is told a settled figure.
 */

/** The part of `lib/credits-gate` this needs, so a test charges without a database. */
export interface PackageGate {
  check(request: Readonly<{ brandId: string; userId: string; kind: ReturnType<typeof packageCreditKind> & string; designVersionHash: string; where: string }>): Promise<GateAnswer>;
}

export type PackageCharge = Readonly<{ charge: ChargeForPackage; note: () => CreditNote | null }>;

/**
 * A `ChargeForPackage` over the gate, and the note to put on the answer afterwards. The note is null when nothing
 * was charged — either because the package is free or because the owner's flag is off.
 */
export function creditCharge(gate: PackageGate, who: Readonly<{ brandId: string; userId: string }>, where: string): PackageCharge {
  let note: CreditNote | null = null;
  const charge: ChargeForPackage = {
    charge: async (decision: ChargeDecision, input: KppInput) => {
      if (!decision.charge) return null;
      const answer = await gate.check({ brandId: who.brandId, userId: who.userId, kind: decision.kind, designVersionHash: input.design.hash, where });
      if (!answer.ok) return answer.message;
      note = answer.note;
      return null;
    },
  };
  return { charge, note: () => note };
}
