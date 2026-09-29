import "server-only";
import { cookies, headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import { cache } from "react";
import type { AuthContext } from "@/lib/auth/service";
import { ACTIVE_BRAND_COOKIE, chooseActiveBrand } from "@/lib/brands/active";
import { listBrands } from "@/lib/brands/service";
import { getEnv } from "@/lib/config/env";
import {
  createAdminClient,
  createSessionClient,
  type CookieAdapter,
} from "@/lib/supabase/clients";
import { imageProviderFrom, type ImageProvider } from "@/lib/providers";
import { sessionCookieOptions } from "@/lib/supabase/cookie-options";
import { loggingAlert } from "@/lib/usage/alert";
import { allowancesFrom } from "@/lib/usage/cost";
import { createUsageMeter, type UsageMeter } from "@/lib/usage/meter";
import { clientAddress } from "./core/client-address";
import type { Brand, GuardDeps, Session } from "./core/guard";
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

/** The signed-in user, read once for each request. */
export const currentSession = cache(
  async (): Promise<Session | null> => readSession(await sessionClient()),
);

/** Every brand the signed-in user belongs to, read once for each request. */
export const currentBrands = cache(
  async (): Promise<Brand[]> => listBrands(await sessionClient()),
);

/**
 * The brand the user is working in. The cookie only says which one they prefer. The
 * database says which ones they belong to, on every request.
 */
export const activeBrand = async (): Promise<Brand | null> =>
  chooseActiveBrand(await currentBrands(), (await cookies()).get(ACTIVE_BRAND_COOKIE)?.value);

const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Remembers, in this browser, which brand the user wants to work in. */
export const rememberActiveBrand = async (brandId: string): Promise<void> => {
  (await cookies()).set(ACTIVE_BRAND_COOKIE, brandId, {
    ...sessionCookieOptions(getEnv().NEXT_PUBLIC_SITE_URL),
    maxAge: ONE_YEAR_IN_SECONDS,
  });
};

export const authContext = async (): Promise<AuthContext> => {
  const env = getEnv();
  return {
    supabase: await sessionClient(),
    admin: adminClient(),
    siteUrl: env.NEXT_PUBLIC_SITE_URL,
    ownerEmail: env.OWNER_EMAIL,
  };
};

let meter: UsageMeter | undefined;

/** The meter for paid AI calls. Allowances come from configuration; see lib/config/env.ts. */
const usageMeter = (): UsageMeter => {
  meter ??= createUsageMeter({
    rpc: (fn, args) => adminClient().rpc(fn, args),
    allowances: allowancesFrom(getEnv()),
    // No email provider exists yet. The alert is a warning in the server log.
    alert: loggingAlert(log),
  });
  return meter;
};

let provider: ImageProvider | null | undefined;

/** The model for photoreal images, or null when no key is set and the feature is unavailable. */
export const imageProvider = (): ImageProvider | null => {
  if (provider === undefined) provider = imageProviderFrom(getEnv());
  return provider;
};

export const productionDeps: GuardDeps = {
  getSession: currentSession,
  getActiveBrand: activeBrand,
  getClientAddress: async () => clientAddress(await headers(), getEnv().CLIENT_ADDRESS_HEADER),
  hitRateLimit: (key, rule) => createRateLimiter(adminClient())(key, rule),
  log,
  usage: {
    reserve: (request) => usageMeter().reserve(request),
    refund: (eventId) => usageMeter().refund(eventId),
  },
  rethrowControlFlow: unstable_rethrow,
};
