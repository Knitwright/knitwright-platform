import { z } from "zod";
import type { UsageAlert } from "./alert";
import type { Allowances, Cost } from "./cost";

export type { Allowances } from "./cost";

/**
 * Reserves and refunds the estimated cost of AI calls through the database, which keeps
 * the totals and applies every limit in one atomic step. Plan step 10, task 3.
 */

export type UsageRpc = (
  fn: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

export type ReserveRequest = Readonly<{
  userId: string;
  brandId: string;
  cost: Cost;
  /** Which route asked, such as "POST /api/intent". Kept with the event. */
  route: string;
}>;

/** Which limit a refused call would have passed. */
export type RefusedBy = "user" | "brand" | "global";

export type Reservation =
  | Readonly<{ ok: true; eventId: string }>
  | Readonly<{ ok: false; refused: RefusedBy }>;

export type UsageMeter = Readonly<{
  reserve: (request: ReserveRequest) => Promise<Reservation>;
  /** Gives back the cost of a call that failed. False when it was already given back. */
  refund: (eventId: string) => Promise<boolean>;
}>;

const answerSchema = z.object({
  ok: z.boolean(),
  event_id: z.string().optional(),
  refused: z.enum(["user", "brand", "global"]).optional(),
  global_spent: z.number(),
  global_ceiling: z.number(),
  alerts: z.array(z.enum(["half", "full"])),
});

type Answer = z.infer<typeof answerSchema>;

const toReservation = (answer: Answer): Reservation | null => {
  if (answer.ok && answer.event_id) return { ok: true, eventId: answer.event_id };
  if (!answer.ok && answer.refused) return { ok: false, refused: answer.refused };
  return null;
};

type MeterDeps = Readonly<{
  rpc: UsageRpc;
  allowances: Allowances;
  alert: UsageAlert;
}>;

const raiseAll = async (alert: UsageAlert, answer: Answer): Promise<void> => {
  for (const level of answer.alerts) {
    try {
      await alert({ level, spent: answer.global_spent, ceiling: answer.global_ceiling });
    } catch {
      // An alert that cannot be sent must not change the answer to the call. The
      // database has recorded it, so the owner can still find it there.
    }
  }
};

export const createUsageMeter = ({ rpc, allowances, alert }: MeterDeps): UsageMeter => ({
  reserve: async ({ userId, brandId, cost, route }) => {
    if (!Number.isInteger(cost.microdollars) || cost.microdollars < 1) {
      throw new Error("A cost must be a whole number of microdollars, at least 1.");
    }
    const { data, error } = await rpc("usage_reserve", {
      p_user_id: userId,
      p_brand_id: brandId,
      p_feature: cost.feature,
      p_cost: cost.microdollars,
      p_route: route,
      p_user_allowance: allowances.user[cost.feature],
      p_brand_allowance: allowances.brand[cost.feature],
      p_global_ceiling: allowances.globalCeiling,
    });
    const parsed = error ? null : answerSchema.safeParse(data);
    const reservation = parsed?.success ? toReservation(parsed.data) : null;
    if (!parsed?.success || !reservation) {
      throw new Error("The cost of the call could not be reserved.", { cause: error ?? data });
    }
    await raiseAll(alert, parsed.data);
    return reservation;
  },

  refund: async (eventId) => {
    const { data, error } = await rpc("usage_refund", { p_event_id: eventId });
    if (error) throw new Error("The cost of the call could not be refunded.", { cause: error });
    return data === true;
  },
});
