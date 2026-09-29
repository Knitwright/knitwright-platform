import type { Reservation, ReserveRequest } from "@/lib/usage/meter";
import type { Brand, GuardDeps, RateLimitRule, Session } from "./guard";

export const SESSION: Session = { userId: "user-1", email: "maker@example.com" };
export const BRAND: Brand = { id: "brand-1", name: "Northfield FC", role: "owner" };

export type Recorded = {
  hits: { key: string; rule: RateLimitRule }[];
  logs: unknown[];
  brandLookups: number;
  reservations: ReserveRequest[];
  refunds: string[];
};

type Overrides = Partial<{
  session: Session | null;
  brand: Brand | null;
  address: string;
  allow: (key: string) => boolean;
  sessionError: Error;
  reserve: (request: ReserveRequest) => Reservation;
  refundError: Error;
}>;

/** In-memory stand-ins for the session store, the rate limiter and the log. */
export const makeDeps = (overrides: Overrides = {}): { deps: GuardDeps; recorded: Recorded } => {
  const recorded: Recorded = {
    hits: [],
    logs: [],
    brandLookups: 0,
    reservations: [],
    refunds: [],
  };
  const deps: GuardDeps = {
    getSession: async () => {
      if (overrides.sessionError) throw overrides.sessionError;
      return overrides.session === undefined ? SESSION : overrides.session;
    },
    getActiveBrand: async () => {
      recorded.brandLookups += 1;
      return overrides.brand === undefined ? BRAND : overrides.brand;
    },
    getClientAddress: async () => overrides.address ?? "203.0.113.7",
    hitRateLimit: async (key, rule) => {
      recorded.hits.push({ key, rule });
      return overrides.allow ? overrides.allow(key) : true;
    },
    log: (event) => {
      recorded.logs.push(event);
    },
    usage: {
      reserve: async (request) => {
        recorded.reservations.push(request);
        return overrides.reserve ? overrides.reserve(request) : { ok: true, eventId: "event-1" };
      },
      refund: async (eventId) => {
        if (overrides.refundError) throw overrides.refundError;
        recorded.refunds.push(eventId);
        return true;
      },
    },
    rethrowControlFlow: (error) => {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    },
  };
  return { deps, recorded };
};

export const RULE: RateLimitRule = { name: "test", limit: 5, windowSeconds: 60 };
