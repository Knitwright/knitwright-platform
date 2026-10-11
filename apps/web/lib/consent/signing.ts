import "server-only";
import { getEnv, unsubscribeSecret } from "@/lib/config/env";
import { unsubscribeKey } from "./unsubscribe-token";

/**
 * The key for unsubscribe links, derived from UNSUBSCRIBE_SECRET (required on a deploy), or from
 * the server's secret key on this machine and in tests.
 */
export const unsubscribeSigningKey = (): Buffer => unsubscribeKey(unsubscribeSecret(getEnv()));
