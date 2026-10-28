import type { SupabaseClient } from "@supabase/supabase-js";
import type { UsageMeter } from "@/lib/usage/meter";

/**
 * Every paid call reserves its cost with the usage meter first (feature "photoreal", the allowance of generated pictures)
 * and is held to a daily cap per brand on top of the meter's monthly allowance. A failed call gives its cost back.
 */

export const LIFESTYLE_ROUTE_PREFIX = "media lifestyle:";

/** A Knitwright default, not agreed with the owner: about five whole sets a day at the dearer adapters. */
export const DEFAULT_DAILY_CAP_MICRODOLLARS = 5_000_000;

export type Spend =
  | Readonly<{ ok: true; refund: () => Promise<void> }>
  | Readonly<{ ok: false; reason: "daily_cap" | "allowance" }>;

export interface Budget {
  take(provider: string, microdollars: number): Promise<Spend>;
}

type BudgetDeps = Readonly<{
  usage: UsageMeter;
  brandId: string;
  userId: string;
  /** Microdollars this brand has spent on lifestyle pictures today (UTC) and not got back. */
  spentToday: () => Promise<number>;
  dailyCapMicrodollars?: number;
}>;

export function usageBudget(deps: BudgetDeps): Budget {
  const cap = deps.dailyCapMicrodollars ?? DEFAULT_DAILY_CAP_MICRODOLLARS;
  let spentHere = 0;
  return {
    async take(provider, microdollars) {
      if (microdollars < 1) return { ok: true, refund: async () => {} };
      // Counted before the first await so the four scenes of one set, running together, cannot all pass the last place.
      const alreadyHere = spentHere;
      spentHere += microdollars;
      const give = () => {
        spentHere -= microdollars;
      };
      if ((await deps.spentToday()) + alreadyHere + microdollars > cap) {
        give();
        return { ok: false, reason: "daily_cap" };
      }
      const reservation = await deps.usage.reserve({
        userId: deps.userId,
        brandId: deps.brandId,
        cost: { feature: "photoreal", microdollars },
        route: `${LIFESTYLE_ROUTE_PREFIX}${provider}`,
      });
      if (!reservation.ok) {
        give();
        return { ok: false, reason: "allowance" };
      }
      return {
        ok: true,
        refund: async () => {
          give();
          await deps.usage.refund(reservation.eventId);
        },
      };
    },
  };
}

/** The sum of today's lifestyle reservations for a brand, read with the member's own client (usage_events allows members to read). */
export async function spentTodayBy(client: SupabaseClient, brandId: string, now: Date = new Date()): Promise<number> {
  const day = now.toISOString().slice(0, 10);
  const { data, error } = await client
    .from("usage_events")
    .select("cost")
    .eq("brand_id", brandId)
    .eq("day", day)
    .like("route", `${LIFESTYLE_ROUTE_PREFIX}%`)
    .is("refunded_at", null);
  if (error) throw new Error("Today's spend could not be read.", { cause: error });
  return (data ?? []).reduce((sum, row) => sum + Number((row as { cost: number | string }).cost), 0);
}
