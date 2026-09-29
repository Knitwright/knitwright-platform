import type { Cost } from "@/lib/usage/cost";
import type { RefusedBy } from "@/lib/usage/meter";
import type { Failure } from "./errors";
import type { GuardDeps } from "./guard";

/**
 * Runs a paid call inside a reservation. Plan step 10, task 5. The estimated cost is
 * reserved before the call; if the call throws, the cost is given back.
 */

/** A fixed cost, or one worked out from the validated input. */
export type RouteCost<I> = Cost | ((input: I) => Cost);

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

export const costOf = <I>(cost: RouteCost<I>, input: I): Cost =>
  typeof cost === "function" ? cost(input) : cost;

export const runMetered = async <T>(
  deps: GuardDeps,
  payer: Payer,
  cost: Cost,
  where: string,
  run: () => Promise<T>,
): Promise<Metered<T>> => {
  const route = where.slice(0, MAX_ROUTE_LENGTH);
  const reservation = await deps.usage.reserve({ ...payer, cost, route });
  if (!reservation.ok) return { ok: false, failure: REFUSALS[reservation.refused] };

  try {
    return { ok: true, value: await run() };
  } catch (error) {
    try {
      await deps.usage.refund(reservation.eventId);
    } catch (refundError) {
      // The call has failed already. Its failure is what the user is told about.
      deps.log({
        level: "error",
        message: "A failed call could not be refunded",
        where,
        error: refundError,
      });
    }
    throw error;
  }
};
