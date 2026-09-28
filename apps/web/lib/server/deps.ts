import "server-only";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { getEnv } from "@/lib/config/env";
import type { AuthContext } from "@/lib/auth/service";
import {
  createAdminClient,
  createSessionClient,
  type CookieAdapter,
} from "@/lib/supabase/clients";
import { clientAddress } from "./core/client-address";
import type { GuardDeps, Session } from "./core/guard";
import { log } from "./log";
import { createRateLimiter } from "./rate-limit";
import { readSession } from "./session";

/**
 * The real session store, rate limiter and log, as the wrappers use them in the app.
 * This file is the only place that joins the framework's request to those services.
 */

const requestCookies = async (): Promise<CookieAdapter> => {
  const store = await cookies();
  return {
    getAll: () => store.getAll(),
    setAll: (toSet) => {
      try {
        for (const { name, value, options } of toSet) store.set(name, value, options);
      } catch {
        // A Server Component cannot write cookies. The session it read is still valid,
        // and proxy.ts writes the refreshed cookies on the same request.
      }
    },
  };
};

/** A client that acts as the visitor making this request. */
export const sessionClient = async () => createSessionClient(getEnv(), await requestCookies());

let admin: ReturnType<typeof createAdminClient> | undefined;

/** One client with full access, shared by every request. It holds no session. */
export const adminClient = () => {
  admin ??= createAdminClient(getEnv());
  return admin;
};

export const currentSession = async (): Promise<Session | null> =>
  readSession(await sessionClient());

export const authContext = async (): Promise<AuthContext> => {
  const env = getEnv();
  return {
    supabase: await sessionClient(),
    admin: adminClient(),
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    ownerEmail: env.OWNER_EMAIL,
  };
};

export const productionDeps: GuardDeps = {
  getSession: currentSession,
  getClientAddress: async () => clientAddress(await headers(), getEnv().CLIENT_ADDRESS_HEADER),
  hitRateLimit: (key, rule) => createRateLimiter(adminClient())(key, rule),
  log,
  rethrowControlFlow: unstable_rethrow,
};
