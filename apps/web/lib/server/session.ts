import type { SupabaseClient } from "@supabase/supabase-js";
import type { Session } from "./core/guard";

type ClaimsResult = Readonly<{
  data: { claims: Readonly<Record<string, unknown>> } | null;
  error: unknown;
}>;

/** Errors that mean "there is no valid session here", whatever status they carry. */
const SIGNED_OUT_ERRORS = new Set(["AuthSessionMissingError", "AuthInvalidJwtError"]);

const TOO_MANY_REQUESTS = 429;

/**
 * True when the sign-in service answered "no": the session is missing, or the token was
 * refused. Anything else (no answer, too busy, an error with no status) is an outage.
 */
const isRefusal = (error: unknown): boolean => {
  if (typeof error !== "object" || error === null) return false;
  if ("name" in error && SIGNED_OUT_ERRORS.has(String(error.name))) return true;
  const status = "status" in error && typeof error.status === "number" ? error.status : 0;
  return status >= 400 && status < 500 && status !== TOO_MANY_REQUESTS;
};

/**
 * Reads a session from verified token claims. Returns null for a visitor who is not
 * signed in. Throws when the sign-in service is unreachable, so an outage is reported
 * as an outage and not as "please sign in".
 */
export const sessionFromClaims = ({ data, error }: ClaimsResult): Session | null => {
  if (error) {
    if (isRefusal(error)) return null;
    throw new Error("The sign-in service could not be reached.", { cause: error });
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
