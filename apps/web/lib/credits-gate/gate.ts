import { OUTPUT_LABELS, type OutputKind } from "@/lib/credits/kinds";
import { CREDIT_SETTINGS } from "@/lib/credits/settings";
import type { CreditsService } from "@/lib/credits/service";
import type { LogEvent } from "@/lib/server/core/guard";

/**
 * Decides whether an output may be made, and charges for it. Decision 0051. The numbers come from
 * lib/credits/settings.ts, which are placeholders until the owner sets prices, so a refusal says so.
 */

export type GateService = Pick<CreditsService, "spendCredits" | "ensureMonthlyAllowance">;

export type GateDeps = Readonly<{
  /** Read on every call, so the owner's flag is not cached by a module. */
  enforced: () => boolean;
  /** Built only when a charge is made, so a flag that is off never reaches the database. */
  service: () => GateService;
  log: (event: LogEvent) => void;
  now: () => Date;
}>;

export type GateRequest = Readonly<{
  brandId: string;
  userId: string;
  kind: OutputKind;
  designVersionHash: string;
  usageEventId?: string;
  /** The route, for the log. */
  where: string;
}>;

/** What the member is told after a charge: the price, whether this download paid it, the balance now. */
export type CreditNote = Readonly<{ price: number; charged: boolean; balance: number }>;

export type GateAnswer =
  | Readonly<{ ok: true; note: CreditNote | null }>
  | Readonly<{ ok: false; message: string; price: number; balance: number }>;

const credits = (count: number): string => `${count} ${count === 1 ? "credit" : "credits"}`;

export const refusalMessage = (kind: OutputKind, price: number, balance: number): string =>
  `${OUTPUT_LABELS[kind]} costs ${credits(price)}. Your balance is ${balance}.` +
  (CREDIT_SETTINGS.isPlaceholder ? " The price is a placeholder the owner has not set yet." : "");

export const createGate = (deps: GateDeps) => ({
  enforced: (): boolean => deps.enforced(),
  check: async (request: GateRequest): Promise<GateAnswer> => {
    if (!deps.enforced()) {
      deps.log({
        level: "info",
        message: `Credits not enforced: ${OUTPUT_LABELS[request.kind]} would have cost ${credits(CREDIT_SETTINGS.prices[request.kind])}`,
        where: request.where,
      });
      return { ok: true, note: null };
    }
    const service = deps.service();
    // The month's free credits are given when a brand first reads them; a brand that goes straight to an export must have them too.
    await service.ensureMonthlyAllowance(request.brandId, deps.now());
    const outcome = await service.spendCredits({
      brandId: request.brandId,
      userId: request.userId,
      kind: request.kind,
      designVersionHash: request.designVersionHash,
      ...(request.usageEventId === undefined ? {} : { usageEventId: request.usageEventId }),
    });
    if (!outcome.ok) {
      return { ok: false, message: refusalMessage(request.kind, outcome.price, outcome.balance), price: outcome.price, balance: outcome.balance };
    }
    return { ok: true, note: { price: outcome.price, charged: outcome.charged, balance: outcome.balance } };
  },
});

export type Gate = ReturnType<typeof createGate>;
