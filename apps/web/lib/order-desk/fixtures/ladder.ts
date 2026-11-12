import type { PriceTier } from "@/lib/factory/schemas";

/** A made-up ladder for the Orders area's tests: £30 at 1+, £27 at 20+, £24 at 50+. */
const CAPABILITY = "00000000-0000-4000-8000-0000000000c1";

export const tier = (qtyMin: number, qtyMax: number | null, gbp: number | null, aud: number | null = null, capabilityId = CAPABILITY): PriceTier => ({
  id: `00000000-0000-4000-8000-${String(qtyMin).padStart(12, "0")}`,
  capabilityId,
  qtyMin,
  qtyMax,
  cost: null,
  sellGbpMinor: gbp,
  sellAudMinor: aud,
  personalisationCostMinor: null,
  ruleId: "R-GAP-000",
  label: "Test tier",
});

export const LADDER: readonly PriceTier[] = [tier(1, 19, 3000), tier(20, 49, 2700), tier(50, null, 2400)];
