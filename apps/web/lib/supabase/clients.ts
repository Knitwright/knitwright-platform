import "server-only";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { sessionCookieOptions } from "./cookie-options";

export type SupabaseSettings = Readonly<{
  NEXT_PUBLIC_SITE_URL: string;
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: string;
  SUPABASE_SECRET_KEY: string;
}>;

export type CookieToSet = Readonly<{ name: string; value: string; options: CookieOptions }>;

/** Where the session is kept. In the app this is the request's cookies. */
export type CookieAdapter = Readonly<{
  getAll: () => { name: string; value: string }[];
  setAll: (cookies: readonly CookieToSet[]) => void;
}>;

/**
 * A client that acts as the signed-in user, or as nobody. Row level security applies.
 * Make a new one for every request: it holds that request's session.
 */
export const createSessionClient = (
  settings: SupabaseSettings,
  cookies: CookieAdapter,
): SupabaseClient =>
  createServerClient(
    settings.NEXT_PUBLIC_SUPABASE_URL,
    settings.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: sessionCookieOptions(settings.NEXT_PUBLIC_SITE_URL),
      cookies: {
        getAll: () => cookies.getAll(),
        setAll: (toSet) => cookies.setAll(toSet),
      },
    },
  );

/**
 * A client with full access. Row level security does not apply, so it is used only for
 * the few things no user may do themselves, such as counting a rate limit.
 */
export const createAdminClient = (settings: SupabaseSettings): SupabaseClient =>
  createClient(settings.NEXT_PUBLIC_SUPABASE_URL, settings.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
