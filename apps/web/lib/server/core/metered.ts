import type { Cost } from "@/lib/usage/cost";
import type { RefusedBy } from "@/lib/usage/meter";
import type { Failure } from "./errors";
import type { GuardDeps } from "./guard";

/**
 * Runs a paid call inside a reservation. Plan step 10, task 5. The estimated cost is
 * reserved before the call; if the call throws, the cost is given back.
 */

/**
 * A fixed cost, or one worked out from the validated input. Null means this request makes
 * no paid call (such as one the rules answer without a model), so nothing is reserved.
 */
export type RouteCost<I> = Cost | ((input: I) => Cost | null);

/**
 * The reservation a handler holds, for work that goes on after the answer has started
 * (a streamed response) or that needs a further call (a retry on a stronger model).
 */
export type RouteUsage = Readonly<{
  /**
   * The usage record this reservation wrote. Work carried on after the response (with
   * `after()`) records it, so it can refund the reservation itself if that work fails.
   */
  eventId: string;
  /** Gives this reservation back. Only the first call does anything. Never throws. */
  refund: () => Promise<void>;
  /** Reserves a further cost for the same payer. Null when an allowance refuses it. */
  reserve: (cost: Cost) => Promise<RouteUsage | null>;
}>;

const REFUSALS: Readonly<Record<RefusedBy, Failure>> = {
  user: {
    code: "over_allowance",
    message: "You have used today's allowance for this. It starts again at midnight UTC.",
  },
  brand: {
    code: "over_allowance",
    message: "Your brand has used today's allowance for this. It starts again at midnight UTC.",
  },
  global: {
    code: "unavailable",
    message: "This is not available for the rest of today. Try again tomorrow.",
  },
};

export type Metered<T> =
  | Readonly<{ ok: true; value: T }>
  | Readonly<{ ok: false; failure: Failure }>;

type Payer = Readonly<{ userId: string; brandId: string }>;

const MAX_ROUTE_LENGTH = 200;

export const costOf = <I>(cost: RouteCost<I>, input: I): Cost | null =>
  typeof cost === "function" ? cost(input) : cost;

const giveBack = async (deps: GuardDeps, eventId: string, where: string): Promise<void> => {
  try {
    await deps.usage.refund(eventId);
  } catch (refundError) {
    // The call has failed already. Its failure is what the user is told about.
    deps.log({
      level: "error",
      message: "A failed call could not be refunded",
      where,
      error: refundError,
    });
  }
};

const usageFor = (deps: GuardDeps, payer: Payer, eventId: string, where: string): RouteUsage => {
  let refunded = false;
  return {
    eventId,
    refund: async () => {
      if (refunded) return;
      refunded = true;
      await giveBack(deps, eventId, where);
    },
    reserve: async (cost) => {
      const reservation = await deps.usage.reserve({ ...payer, cost, route: where.slice(0, MAX_ROUTE_LENGTH) });
      return reservation.ok ? usageFor(deps, payer, reservation.eventId, where) : null;
    },
  };
};

export const runMetered = async <T>(
  deps: GuardDeps,
  payer: Payer,
  cost: Cost,
  where: string,
  run: (usage: RouteUsage) => Promise<T>,
): Promise<Metered<T>> => {
  const route = where.slice(0, MAX_ROUTE_LENGTH);
  const reservation = await deps.usage.reserve({ ...payer, cost, route });
  if (!reservation.ok) return { ok: false, failure: REFUSALS[reservation.refused] };

  const usage = usageFor(deps, payer, reservation.eventId, where);
  try {
    return { ok: true, value: await run(usage) };
  } catch (error) {
    await usage.refund();
    throw error;
  }
};
