import "server-only";
import { getEnv } from "@/lib/config/env";
import { unsubscribeKey } from "./unsubscribe-token";

/** The key for unsubscribe links, derived from the server's secret like the proposal key. */
export const unsubscribeSigningKey = (): Buffer => unsubscribeKey(getEnv().SUPABASE_SECRET_KEY);
