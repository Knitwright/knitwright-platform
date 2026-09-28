import type { SupabaseClient } from "@supabase/supabase-js";

/** Whether anyone may register. Any failure counts as closed, which is the safe answer. */
export const isSignupOpen = async (client: SupabaseClient): Promise<boolean> => {
  const { data, error } = await client.rpc("signup_is_open");
  return !error && data === true;
};
