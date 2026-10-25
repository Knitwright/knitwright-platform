import "server-only";
import { adminClient } from "@/lib/server/deps";
import { loadCreditSettings } from "@/lib/settings/read";
import { createCreditsService, type CreditsService } from "./service";

/** The credit service wired to the server's own database key. Call it only after the session is checked. */
export const creditsService = (): CreditsService => {
  const client = adminClient();
  return createCreditsService({
    readSettings: () => loadCreditSettings(client),
    rpc: (fn, args) => client.rpc(fn, args),
    readLedger: async (brandId, limit) => {
      const { data, error } = await client
        .from("credit_ledger")
        .select("id, kind, amount, output_kind, design_version_hash, refund_of, idempotency_key, note, created_at")
        .eq("brand_id", brandId)
        .order("seq", { ascending: false })
        .limit(limit);
      if (error) throw new Error("The credits could not be read.", { cause: error });
      return [...data].reverse();
    },
  });
};

/**
 * The brand's summary after giving its free credits for the month, once. Reading the credits is
 * the moment the allowance is given, so no scheduled job is needed; the database makes it once.
 */
export const creditSummaryFor = async (brandId: string, now: Date = new Date()) => {
  const service = creditsService();
  await service.ensureMonthlyAllowance(brandId, now);
  return service.summary(brandId);
};
