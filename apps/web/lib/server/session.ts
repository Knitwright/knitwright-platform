import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "./core/guard";

type ClaimsResult = Readonly<{
  data: { claims: Readonly<Record<string, unknown>> } | null;
  error: unknown;
}>;

/** True when the sign-in service could not answer, as opposed to answering "no". */
const isOutage = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return true;
  const name = "name" in error ? String(error.name) : "";
  const status = "status" in error && typeof error.status === "number" ? error.status : 0;
  return name === "AuthRetryableFetchError" || status >= 500;
};

/**
 * Reads a session from verified token claims. Returns null for a visitor who is not
 * signed in. Throws when the sign-in service is unreachable, so an outage is reported
 * as an outage and not as "please sign in".
 */
export const sessionFromClaims = ({ data, error }: ClaimsResult): Session | null => {
  if (error) {
    if (isOutage(error)) {
      throw new Error("The sign-in service could not be reached.", { cause: error });
    }
    return null;
  }

  const claims = data?.claims;
  if (!claims || claims.is_anonymous === true) return null;
  if (typeof claims.sub !== "string" || claims.sub.length === 0) return null;

  return {
    userId: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
};

/** The signed-in user for this client's cookies, verified by signature. */
export const readSession = async (client: SupabaseClient): Promise<Session | null> =>
  sessionFromClaims(await client.auth.getClaims());
