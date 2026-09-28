import type { GuardDeps, RateLimitRule, Session } from "./guard";

export const SESSION: Session = { userId: "user-1", email: "maker@example.com" };

export type Recorded = {
  hits: { key: string; rule: RateLimitRule }[];
  logs: unknown[];
};

type Overrides = Partial<{
  session: Session | null;
  address: string;
  allow: (key: string) => boolean;
  sessionError: Error;
}>;

/** In-memory stand-ins for the session store, the rate limiter and the log. */
export const makeDeps = (overrides: Overrides = {}): { deps: GuardDeps; recorded: Recorded } => {
  const recorded: Recorded = { hits: [], logs: [] };
  const deps: GuardDeps = {
    getSession: async () => {
      if (overrides.sessionError) throw overrides.sessionError;
      return overrides.session === undefined ? SESSION : overrides.session;
    },
    getClientAddress: async () => overrides.address ?? "203.0.113.7",
    hitRateLimit: async (key, rule) => {
      recorded.hits.push({ key, rule });
      return overrides.allow ? overrides.allow(key) : true;
    },
    log: (event) => {
      recorded.logs.push(event);
    },
    rethrowControlFlow: (error) => {
      if (error instanceof Error && error.message === "NEXT_REDIRECT") throw error;
    },
  };
  return { deps, recorded };
};

export const RULE: RateLimitRule = { name: "test", limit: 5, windowSeconds: 60 };
