/**
 * Puts the 50 marketing templates in the library of the database named by the environment. Run it
 * from apps/web after `pnpm db:start`, and after every `supabase db reset`, which empties the
 * library:
 *
 *   pnpm --filter web exec tsx --env-file=.env.local lib/marketing/templates/run.mts
 *
 * Running it again changes the rows it made and adds nothing. It is its own script rather than a
 * line in `lib/templates/seed/run.mts`, which workstream L8 owns.
 */
import { createClient } from "@supabase/supabase-js";
import { seedMarketingTemplates } from "./seed";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY must be set.");

const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const written = await seedMarketingTemplates(admin);
process.stdout.write(`${written} marketing templates written.\n`);
